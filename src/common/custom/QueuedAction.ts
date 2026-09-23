import {CardName} from '../cards/CardName';

/**
 * One action a player has queued up to be taken automatically at the start of their turn.
 *
 * Card and project names are matched against what the player could do at that moment. Payment is
 * chosen automatically: megacredits first, then steel and titanium where the card allows it.
 */
export type QueuedAction =
  {type: 'playCard', card: CardName} |
  {type: 'cardAction', card: CardName} |
  {type: 'standardProject', name: CardName} |
  {type: 'claimMilestone', name: string} |
  {type: 'fundAward', name: string} |
  {type: 'convertPlants'} |
  {type: 'convertHeat'} |
  {type: 'endTurn'} |
  {type: 'pass'};

export type QueuedActionType = QueuedAction['type'];

export const QUEUED_ACTION_TYPES: ReadonlyArray<QueuedActionType> = [
  'playCard', 'cardAction', 'standardProject', 'claimMilestone', 'fundAward', 'convertPlants', 'convertHeat', 'endTurn', 'pass',
] as const;

export const MAX_QUEUED_ACTIONS = 20;

/** The player's queue as the client sees it. */
export type ActionQueueModel = {
  queue: Array<QueuedAction>;
  /** Why the queue last stopped, until the player edits the queue again. */
  stoppedReason?: string;
  /** The actions taken from the queue since it was last edited. */
  executed: Array<QueuedAction>;
};

/** A human readable label for a queued action. */
export function describeQueuedAction(action: QueuedAction): string {
  switch (action.type) {
  case 'playCard': return `Play ${action.card}`;
  case 'cardAction': return `Use action of ${action.card}`;
  case 'standardProject': return `Standard project: ${action.name}`;
  case 'claimMilestone': return `Claim milestone ${action.name}`;
  case 'fundAward': return `Fund award ${action.name}`;
  case 'convertPlants': return 'Convert plants into a greenery';
  case 'convertHeat': return 'Convert heat into temperature';
  case 'endTurn': return 'End turn';
  case 'pass': return 'Pass for this generation';
  }
}
