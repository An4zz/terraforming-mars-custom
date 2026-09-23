import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {addCardCopies, effectiveCopies} from '@/server/custom/deck/cardCopies';
import {newPrelude, newProjectCard} from '@/server/createCard';
import {IProjectCard} from '@/server/cards/IProjectCard';
import {Algae} from '@/server/cards/base/Algae';
import {Comet} from '@/server/cards/base/Comet';
import {IPreludeCard} from '@/server/cards/prelude/IPreludeCard';
import {Biolab} from '@/server/cards/prelude/Biolab';

describe('addCardCopies', () => {
  let cards: Array<IProjectCard>;
  const options = {banned: [] as Array<CardName>, factory: newProjectCard};

  beforeEach(() => {
    cards = [new Algae(), new Comet()];
  });

  function count(name: CardName): number {
    return cards.filter((card) => card.name === name).length;
  }

  it('leaves the deck alone without copies', () => {
    addCardCopies(cards, undefined, options);
    addCardCopies(cards, {}, options);
    expect(cards).has.length(2);
  });

  it('adds copies up to the requested total as distinct instances', () => {
    addCardCopies(cards, {[CardName.ALGAE]: 3}, options);
    expect(count(CardName.ALGAE)).eq(3);
    expect(count(CardName.COMET)).eq(1);
    const algae = cards.filter((card) => card.name === CardName.ALGAE);
    expect(new Set(algae).size).eq(3);
  });

  it('ignores counts of one or less and non-numbers', () => {
    addCardCopies(cards, {[CardName.ALGAE]: 1, [CardName.COMET]: 0, [CardName.BIRDS]: NaN}, options);
    expect(cards).has.length(2);
    expect(effectiveCopies(undefined)).eq(1);
    expect(effectiveCopies(-4)).eq(1);
    expect(effectiveCopies(2.9)).eq(2);
  });

  it('caps the count', () => {
    addCardCopies(cards, {[CardName.ALGAE]: 99}, options);
    expect(count(CardName.ALGAE)).eq(10);
  });

  it('skips banned cards', () => {
    addCardCopies(cards, {[CardName.ALGAE]: 3}, {...options, banned: [CardName.ALGAE]});
    expect(count(CardName.ALGAE)).eq(1);
  });

  it('adds a card that is not in the deck with the full count', () => {
    addCardCopies(cards, {[CardName.BIRDS]: 2}, options);
    expect(count(CardName.BIRDS)).eq(2);
  });

  it('ignores names that are not this kind of card', () => {
    addCardCopies(cards, {[CardName.BIOLAB]: 3, ['Not A Card' as CardName]: 3}, {...options, factory: (name) => name === CardName.BIOLAB ? undefined : newProjectCard(name)});
    expect(cards).has.length(2);
  });

  it('applies to preludes with the prelude factory', () => {
    const preludes: Array<IPreludeCard> = [new Biolab()];
    addCardCopies(preludes, {[CardName.BIOLAB]: 2, [CardName.ALGAE]: 2}, {banned: [], factory: newPrelude});
    expect(preludes.map((card) => card.name)).deep.eq([CardName.BIOLAB, CardName.BIOLAB]);
  });

  it('resolves renamed cards', () => {
    addCardCopies(cards, {['Terralabs Research' as CardName]: 2}, options);
    expect(count(CardName.TERRALABS_RESEARCH)).eq(0); // A corporation: not a project card.
    addCardCopies(cards, {['Colony' as CardName]: 2}, options);
    expect(cards).has.length(2); // A standard project: not a project card either.
  });
});
