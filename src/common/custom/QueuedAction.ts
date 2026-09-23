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

/** Items that end the turn or the generation, so nothing may follow them. */
export const TERMINAL_ACTION_TYPES: ReadonlyArray<QueuedActionType> = ['endTurn', 'pass'] as const;

export const MAX_QUEUED_ACTIONS = 20;

/** The queue as stored with the player. */
export type ActionQueueState = {
  queue: Array<QueuedAction>;
  /** True while the queue must not run: set by the player, or by the server after a stop. */
  paused: boolean;
  /** Why the queue last stopped, until the player edits or resumes it. */
  stoppedReason?: string;
  /** The actions taken from the queue since it was last edited. */
  executed: Array<QueuedAction>;
  /** The game's undo count when the queue was last edited; an undo since then pauses it. */
  undoCount?: number;
};

export function emptyActionQueue(): ActionQueueState {
  return {queue: [], paused: false, executed: []};
}

/** What the player can queue right now, for building the menu. */
export type ActionQueueOptions = {
  cardsInHand: Array<CardName>;
  actionCards: Array<CardName>;
  standardProjects: Array<CardName>;
  milestones: Array<string>;
  awards: Array<string>;
};

/** The player's queue as the client sees it. */
export type ActionQueueModel = ActionQueueState & {
  options: ActionQueueOptions;
};

/** The body posted to change a queue. */
export type ActionQueueRequest =
  {op: 'set', queue: Array<QueuedAction>} |
  {op: 'pause'} |
  {op: 'resume'} |
  {op: 'clear'};

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

/** Checks a queue sent by a client. Returns the problem, or `undefined` when it is fine. */
export function validateQueue(queue: unknown): string | undefined {
  if (!Array.isArray(queue)) {
    return 'The queue must be a list';
  }
  if (queue.length > MAX_QUEUED_ACTIONS) {
    return `At most ${MAX_QUEUED_ACTIONS} actions can be queued`;
  }
  for (let i = 0; i < queue.length; i++) {
    const item = queue[i];
    if (typeof item !== 'object' || item === null || !QUEUED_ACTION_TYPES.includes(item.type)) {
      return `Item ${i + 1} is not a queueable action`;
    }
    const needsCard = item.type === 'playCard' || item.type === 'cardAction';
    const needsName = item.type === 'standardProject' || item.type === 'claimMilestone' || item.type === 'fundAward';
    if (needsCard && (typeof item.card !== 'string' || item.card.length === 0)) {
      return `Item ${i + 1} needs a card`;
    }
    if (needsName && (typeof item.name !== 'string' || item.name.length === 0)) {
      return `Item ${i + 1} needs a name`;
    }
    if (TERMINAL_ACTION_TYPES.includes(item.type) && i !== queue.length - 1) {
      return `${describeQueuedAction(item)} must be the last item`;
    }
  }
  return undefined;
}
