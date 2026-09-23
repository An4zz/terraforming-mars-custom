# Feature 3: Action queue

## Feature description

Asynchronous games spend most of their time waiting. A player often knows what they will do
next ("play Nitrogen-Rich Asteroid, then fund Banker, then pass") but must wait for their turn
to click. This feature lets a player queue up actions from their player page. When their turn
starts, the server executes the queued actions in order, one action per available slot, as if
the player had clicked them. Before each action the server checks it is still legal (card still
in hand and affordable, milestone unclaimed, award unfunded, enough plants/heat, standard
project affordable). The first action that is no longer possible stops the queue, leaves the
remaining items in place, records why, notifies the player (in-game log, and Discord if opted
in), and hands the turn back to the player normally.

Follow-up choices inside a queued action (which space for the city, which player loses plants,
how to pay) are the natural boundary of automation: payment is chosen automatically with the
same rules as the client's payment defaults (megacredits first, then steel/titanium where the
card allows), but any other choice pauses the queue at that prompt and waits for the player.
The queue resumes with the next item once that action is complete.

## Requirements and user stories

- **Q-1** As a player, on my player page I can add actions to a queue: play a card from my
  hand, use a blue card action, a standard project, claim a milestone, fund an award, convert
  plants, convert heat, end turn, pass. I can reorder and remove items and clear the queue.
- **Q-2** As a player, when my turn starts the queue runs automatically and I can see in the
  log which queued actions were taken.
- **Q-3** As a player, if a queued action is no longer possible, the queue stops before it,
  nothing else runs, and I am told which item stopped it and why.
- **Q-4** As a player, if a queued card needs a choice the server cannot make for me (tile
  placement, target player, optional effects), the game shows me that prompt as usual, and the
  queue continues after I answer.
- **Q-5** As a player, the queue persists with the game (survives server restarts and undo).
- **Q-6** As a player, I can pause the queue without clearing it.
- **Q-7** As a player, I cannot queue more than 20 actions, and "pass" or "end turn" must be
  the last item.
- **Q-8** As an opponent, I cannot see or change another player's queue.
- **Q-9** The queue never runs during the research phase, drafting, prelude/CEO phases or the
  final greenery step; only in the action phase when it is this player's turn.
- **Q-10** Undo still works: undoing after queued actions restores the pre-queue state and
  pauses the queue so it does not immediately re-run.

Acceptance criteria:
- Queue `[playCard Power Plant, standardProject Asteroid, pass]` with enough M€ results in
  both actions and a pass being taken at turn start without any client input; the log shows
  "(queued)" on each.
- Queue `[playCard Comet]` when Comet has been sold from hand stops with reason
  "Comet is not in your hand" and the player receives the normal "take your action" prompt.
- Queue `[playCard Domed Crater]` executes payment automatically and then shows the
  `SelectSpace` prompt for the city; after choosing, the next queue item runs.
- After `game.serialize()`/`deserialize()` the queue and its status are intact.

## Proposed design

**Data.** `src/common/custom/QueuedAction.ts`:
```ts
type QueuedAction = {type:'playCard', card} | {type:'cardAction', card} | {type:'standardProject', name}
  | {type:'claimMilestone', name} | {type:'fundAward', name} | {type:'convertPlants'} | {type:'convertHeat'}
  | {type:'endTurn'} | {type:'pass'};
type ActionQueueModel = {queue: Array<QueuedAction>; paused: boolean; stoppedReason?: string; executed: Array<QueuedAction>};
```
Stored on `Player` as `actionQueue: ActionQueueState` and serialized in `SerializedPlayer`
(`actionQueue?`), deserialized with a default (`?? empty`).

**Server.** `src/server/custom/queue/`:
- `ActionQueueRunner.ts`: `maybeRun(player)`. Called from `Player.takeAction` immediately after
  `this.setWaitingFor(this.getActions(), …)` (the action-phase branch, `Player.ts:1551`), which
  guarantees Q-9 because prelude/CEO/research/draft paths return earlier. It reads the head of
  the queue, computes an `InputResponse` for the current `OrOptions` with `matchQueuedAction`,
  and if found calls `player.process(response)` (the same entry point the HTTP route uses, so
  validation, deferred actions and the follow-up callback behave identically). If no match, it
  sets `stoppedReason`, logs `${player} action queue stopped: <reason>` reserved for the player,
  and notifies via `TurnNotifier`. Errors thrown by `process` (e.g. `InputError` for payment)
  are caught and treated as a stop; `process` already restores `waitingFor` on error.
- `matchQueuedAction.ts`: walks the `OrOptions` produced by `getActions()`
  (`Player.ts:1562-1680`) and finds the option index and inner response:
  `playCard` → the `SelectProjectCardToPlay` option, card by name, payment from
  `autoPayment(player, cost, canUseSteel/Titanium)`; `cardAction` → the `SelectCard` from
  `playActionCard()`; `standardProject` → `SelectStandardProjectToPlay` by name; milestone and
  award → the nested `OrOptions` titled "Claim a milestone" / "Fund an award" and the
  `SelectOption` whose title equals the name; convert plants/heat, end turn, pass → `SelectOption`
  by title. Titles are stable server strings, but the matcher prefers `instanceof` checks and
  only falls back to titles for `SelectOption`s.
- `autoPayment.ts`: mirrors `PaymentDefaults.ts` on the client: spend steel on building-tag
  cards and titanium on space-tag cards only if M€ alone is insufficient; never spends heat,
  plants or card resources; returns `undefined` if the card cannot be afforded.
- Recursion bound: `process` → callback → `takeAction` → `maybeRun` → next item. Each step
  consumes one item, so depth ≤ queue length (≤ 20).
- `ApiActionQueue.ts`: `GET api/custom/queue?id=<playerId>` returns `ActionQueueModel`;
  `POST` replaces the queue (validates size, terminal items, that names are strings), pauses,
  resumes, or clears. Player-id secrecy provides Q-8 exactly as the rest of the API.
- Undo (Q-10): `PlayerInput.performUndo` restores an older save whose queue state predates the
  run; to stop the restored queue from re-running instantly, the runner sets `paused = true`
  in memory on the restored player when `game.undoCount` increased (hook: after
  `restoreGameAt` in the runner, not in upstream code — the API route for the queue exposes the
  pause and the client shows "paused after undo").

**Client.** `src/client/components/custom/ActionQueuePanel.vue` in `CustomPlayerPanel.vue` on the
player page: list of queued items with up/down/remove; "Add" menu built from the player view
model (cards in hand, active tableau cards with actions, standard projects list from
`game.gameOptions`/constants, unclaimed milestones, unfunded awards, convert plants/heat, end
turn, pass); pause/resume/clear; status line with `stoppedReason` and the last executed items.
Refreshes after every `playerView` update (watch) so the panel tracks the server state.

**Upstream hooks.** `Player.ts` (field, serialize/deserialize, one call in `takeAction`),
`SerializedPlayer.ts` (one optional field), `IPlayer.ts` (field declaration),
`paths.ts`/`requestProcessor.ts`, `PlayerHome.vue` (panel). Log messages go through
`game.log` unchanged.

**Edge cases.** Queue with an action for a card that requires a resource the player will only
have after the previous queued action: works because legality is evaluated when the item's
turn comes. Two actions per turn: `getActions` is rebuilt after each action, so "End turn"
becomes available at the right time. Escape Velocity timers: the timer stops/starts in
`setWaitingFor`/`process` as usual, so queued actions count as instantaneous. Fast mode: no
"end turn" option exists; a queued `endTurn` stops the queue with "End turn is not available in
fast mode".

## Execution tasks

Build:
1. Types, `Player` field, serialization with backward-compatible default.
2. `autoPayment`, `matchQueuedAction`, `ActionQueueRunner`; hook in `takeAction`.
3. Log/notification on stop; pause on undo.
4. `ApiActionQueue` route; register path.
5. `ActionQueuePanel.vue` + `CustomPlayerPanel.vue`; embed in `PlayerHome.vue`.
6. Docs.

Test:
- Unit (server): `autoPayment.spec.ts` — M€ only; steel on building; titanium on space; refuses
  when unaffordable; respects `canUseSteel/Titanium` flags.
- Unit (server): `matchQueuedAction.spec.ts` — one case per action type against a real
  `getActions()` from `testGame`, including "not available" results with reasons.
- Unit (server): `ActionQueueRunner.spec.ts` — runs items in order across two actions; stops on
  first impossible item and leaves the rest; pauses at a `SelectSpace` follow-up and resumes;
  errors from `process` stop cleanly; paused queue does nothing; not run during research or
  prelude phases; serialize/deserialize preserves state; undo pauses.
- Route: `ApiActionQueue.spec.ts` — get/replace/pause/clear; rejects >20, non-terminal pass,
  malformed items; 404 unknown player.
- Unit (client): `ActionQueuePanel.spec.ts` — add from hand, reorder, remove, pause, posts the
  right body, shows stopped reason.
- Integration: `tests/custom/integration/actionQueueGame.spec.ts` — 2-player game; player 2
  queues card + standard project + pass; player 1 passes; assert player 2's tableau, M€, passed
  state, log entries, and that player 1 becomes active again; then a queue with a tile-placing
  card asserts the `SelectSpace` pause and resume.
- Manual: two browsers; queue on one, play the other; watch the queue execute and the stop
  notice appear.
