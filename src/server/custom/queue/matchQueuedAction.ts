import {CardName} from '@/common/cards/CardName';
import {Tag} from '@/common/cards/Tag';
import {QueuedAction, describeQueuedAction} from '@/common/custom/QueuedAction';
import {InputResponse, OrOptionsResponse} from '@/common/inputs/InputResponse';
import {IPlayer} from '@/server/IPlayer';
import {PlayerInput} from '@/server/PlayerInput';
import {OrOptions} from '@/server/inputs/OrOptions';
import {SelectCard} from '@/server/inputs/SelectCard';
import {SelectOption} from '@/server/inputs/SelectOption';
import {SelectProjectCardToPlay} from '@/server/inputs/SelectProjectCardToPlay';
import {SelectStandardProjectToPlay} from '@/server/inputs/SelectStandardProjectToPlay';
import {autoPayment} from './autoPayment';

export type QueueMatch = {response: OrOptionsResponse} | {reason: string};

function titleOf(input: PlayerInput): string {
  return typeof input.title === 'string' ? input.title : input.title.message;
}

function orResponse(index: number, response: InputResponse): QueueMatch {
  return {response: {type: 'or', index, response}};
}

function findOption(actions: OrOptions, predicate: (option: PlayerInput) => boolean): number {
  return actions.options.findIndex(predicate);
}

function selectOptionByTitle(actions: OrOptions, titleStart: string): number {
  return findOption(actions, (o) => o instanceof SelectOption && titleOf(o).startsWith(titleStart));
}

function nestedSelectOption(actions: OrOptions, groupTitleStart: string, name: string, item: QueuedAction, what: string): QueueMatch {
  const groupIndex = findOption(actions, (o) => o instanceof OrOptions && titleOf(o).startsWith(groupTitleStart));
  if (groupIndex === -1) {
    return {reason: `${describeQueuedAction(item)}: no ${what} can be ${what === 'milestone' ? 'claimed' : 'funded'} right now`};
  }
  const group = actions.options[groupIndex] as OrOptions;
  const index = group.options.findIndex((o) => o instanceof SelectOption && titleOf(o) === name);
  if (index === -1) {
    return {reason: `${describeQueuedAction(item)}: ${name} is not available`};
  }
  return orResponse(groupIndex, {type: 'or', index, response: {type: 'option'}});
}

/**
 * Finds how to answer the turn's action menu for `item`, or why that is not possible.
 *
 * Only the top-level choice (and the card's payment) is decided here; any further question the
 * action asks is left to the player.
 */
export function matchQueuedAction(player: IPlayer, actions: OrOptions, item: QueuedAction): QueueMatch {
  switch (item.type) {
  case 'playCard': {
    const index = findOption(actions, (o) => o instanceof SelectProjectCardToPlay);
    const select = index === -1 ? undefined : actions.options[index] as SelectProjectCardToPlay;
    const card = select?.cards.find((c) => c.name === item.card);
    if (select === undefined || card === undefined) {
      const inHand = player.cardsInHand.some((c) => c.name === item.card);
      return {reason: inHand ? `${item.card} cannot be played right now` : `${item.card} is not in your hand`};
    }
    const payment = autoPayment(player, player.getCardCost(card), {
      steel: card.tags.includes(Tag.BUILDING),
      titanium: card.tags.includes(Tag.SPACE),
    });
    if (payment === undefined) {
      return {reason: `You cannot afford ${item.card}`};
    }
    return orResponse(index, {type: 'projectCard', card: item.card, payment});
  }
  case 'cardAction': {
    const index = findOption(actions, (o) => o instanceof SelectCard && titleOf(o) === 'Perform an action from a played card');
    const select = index === -1 ? undefined : actions.options[index] as SelectCard<any>;
    if (select === undefined || !select.cards.some((c: {name: CardName}) => c.name === item.card)) {
      return {reason: `The action of ${item.card} is not available right now`};
    }
    return orResponse(index, {type: 'card', cards: [item.card]});
  }
  case 'standardProject': {
    const index = findOption(actions, (o) => o instanceof SelectStandardProjectToPlay);
    const select = index === -1 ? undefined : actions.options[index] as SelectStandardProjectToPlay;
    const projectIndex = select?.cards.findIndex((c) => c.name === item.name) ?? -1;
    const project = select?.cards[projectIndex];
    if (select === undefined || project === undefined) {
      return {reason: `Standard project ${item.name} is not in this game`};
    }
    if (select.enabled?.[projectIndex] === false || !project.canAct(player)) {
      return {reason: `Standard project ${item.name} is not available right now`};
    }
    const canPayWith = project.canPayWith(player);
    const payment = autoPayment(player, project.getAdjustedCost(player), {steel: canPayWith.steel, titanium: canPayWith.titanium});
    if (payment === undefined) {
      return {reason: `You cannot afford standard project ${item.name}`};
    }
    return orResponse(index, {type: 'projectCard', card: item.name, payment});
  }
  case 'claimMilestone':
    return nestedSelectOption(actions, 'Claim a milestone', item.name, item, 'milestone');
  case 'fundAward':
    return nestedSelectOption(actions, 'Fund an award', item.name, item, 'award');
  case 'convertPlants': {
    const index = findOption(actions, (o) => o.type === 'space' && titleOf(o).startsWith('Convert '));
    if (index === -1) {
      return {reason: 'You cannot convert plants right now'};
    }
    return {reason: 'Convert plants needs you to choose the space: place the greenery, then resume the queue'};
  }
  case 'convertHeat': {
    const index = selectOptionByTitle(actions, 'Convert ');
    if (index === -1) {
      return {reason: 'You cannot convert heat right now'};
    }
    return orResponse(index, {type: 'option'});
  }
  case 'endTurn': {
    const index = selectOptionByTitle(actions, 'End Turn');
    if (index === -1) {
      return {reason: 'End turn is not available right now (it appears after your first action, and never in fast mode)'};
    }
    return orResponse(index, {type: 'option'});
  }
  case 'pass': {
    const index = selectOptionByTitle(actions, 'Pass for this generation');
    if (index === -1) {
      return {reason: 'Passing is not available right now'};
    }
    return orResponse(index, {type: 'option'});
  }
  }
}
