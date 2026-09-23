import {ActionQueueOptions, ActionQueueState, describeQueuedAction} from '@/common/custom/QueuedAction';
import {Phase} from '@/common/Phase';
import {isIActionCard} from '@/server/cards/ICard';
import {IPlayer} from '@/server/IPlayer';
import {OrOptions} from '@/server/inputs/OrOptions';
import {SelectPayment} from '@/server/inputs/SelectPayment';
import {TurnNotifier} from '../discord/TurnNotifier';
import {autoPayment} from './autoPayment';
import {matchQueuedAction} from './matchQueuedAction';

/**
 * Runs a player's action queue at the start of their turn.
 *
 * `maybeRun` is called right after the action menu is offered. It answers the menu for the first
 * queued item through the same path the browser uses, which re-enters the turn and calls it
 * again for the next item. The first item that cannot be taken pauses the queue with a reason.
 */
export class ActionQueueRunner {
  /** Stops the queue, tells the player why, and leaves the queue intact for them to fix. */
  public static stop(player: IPlayer, reason: string): void {
    const state = player.actionQueue;
    state.paused = true;
    state.stoppedReason = reason;
    player.game.log('${0} action queue stopped: ' + reason, (b) => b.player(player), {reservedFor: player});
    TurnNotifier.getInstance().notify(player, `your action queue stopped: ${reason}`);
  }

  /** Answers a payment prompt the last queued action raised, so awards and milestones need no click. */
  private static resolveAutoPayment(player: IPlayer): void {
    const waitingFor = player.getWaitingFor();
    if (!(waitingFor instanceof SelectPayment)) {
      return;
    }
    const payment = autoPayment(player, waitingFor.amount, {steel: waitingFor.paymentOptions.steel, titanium: waitingFor.paymentOptions.titanium});
    if (payment === undefined) {
      ActionQueueRunner.stop(player, 'the payment could not be made automatically');
      return;
    }
    player.process({type: 'payment', payment});
  }

  public static maybeRun(player: IPlayer): void {
    const state: ActionQueueState = player.actionQueue;
    if (state.paused || state.queue.length === 0) {
      return;
    }
    const game = player.game;
    if (game.phase !== Phase.ACTION) {
      return;
    }
    if (state.undoCount !== undefined && game.undoCount !== state.undoCount) {
      ActionQueueRunner.stop(player, 'the game was undone; check the queue and resume it');
      return;
    }
    const actions = player.getWaitingFor();
    if (!(actions instanceof OrOptions)) {
      return;
    }
    const item = state.queue[0];
    const match = matchQueuedAction(player, actions, item);
    if ('reason' in match) {
      ActionQueueRunner.stop(player, match.reason);
      return;
    }
    // The item is consumed before processing: processing re-enters the turn and this runner.
    state.queue.shift();
    state.executed.push(item);
    game.log('${0} took a queued action: ' + describeQueuedAction(item), (b) => b.player(player));
    try {
      player.process(match.response);
    } catch (e) {
      state.executed.pop();
      state.queue.unshift(item);
      ActionQueueRunner.stop(player, `${describeQueuedAction(item)} failed: ${e instanceof Error ? e.message : String(e)}`);
      return;
    }
    ActionQueueRunner.resolveAutoPayment(player);
  }

  /** What the player could queue right now. */
  public static options(player: IPlayer): ActionQueueOptions {
    const game = player.game;
    return {
      cardsInHand: player.cardsInHand.map((c) => c.name),
      actionCards: player.tableau.filter((c) => isIActionCard(c)).map((c) => c.name),
      standardProjects: game.getStandardProjects().map((c) => c.name),
      milestones: game.milestones.filter((m) => !game.milestoneClaimed(m)).map((m) => m.name),
      awards: game.awards.filter((a) => !game.hasBeenFunded(a)).map((a) => a.name),
    };
  }
}
