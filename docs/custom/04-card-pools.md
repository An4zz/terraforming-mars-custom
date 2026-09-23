# Feature 4: Custom card pools (duplicate cards)

## Feature description

Today a project card exists once in the deck; the only knobs are ban and include lists. This
feature lets a host set how many copies of chosen project cards and preludes are in the deck
("3× Asteroid Mining, 2× Earth Catapult"). It is the deck-composition half of "advanced custom
card pools"; the include/ban lists and expansion toggles remain the way to add or remove cards.
Corporations and CEOs are excluded: two players holding the same corporation breaks
per-corporation rules, and CEOs are unique by design.

## Requirements and user stories

- **CP-1** As a host, on the new-game page I can search for a project card or prelude and set
  its copy count (1–10), and see the list of cards with more than one copy.
- **CP-2** As a host, my copy counts are part of the settings JSON and of presets, so a pool is
  reusable.
- **CP-3** As a player, extra copies behave like the original card: same cost, tags,
  requirements, effect, VP; each copy tracks its own resources.
- **CP-4** As a player, I can hold, play, discard and sell two copies of the same card, and the
  UI shows both.
- **CP-5** A banned card cannot be given copies (the ban wins); a card not in the enabled
  expansions is added to the deck by giving it copies, exactly as `includedCards` does today.
- **CP-6** The deck size shown in the sidebar reflects the extra copies.

Acceptance criteria:
- With `cardCopies: {Asteroid: 3}` the new game's project deck contains exactly three
  `Asteroid` instances that are distinct objects.
- A player dealt two copies of an active card with resources can add resources to each
  independently, and both appear in the tableau.
- Selling patents with two copies in hand sells the chosen number, not all copies.

## Proposed design

**Data.** `CardCopies = Partial<Record<CardName, number>>` in
`src/common/custom/CustomGameOptions.ts`; `cardCopies?: CardCopies` added to
`NewGameConfig`, `GameOptions` (default `{}`), and copied in `ApiCreateGame.ts`. Counts are
the *total* copies (1 means default).

**Server.** `src/server/custom/deck/cardCopies.ts` exports
`addCardCopies(cards: Array<T>, copies: CardCopies, factory: (name) => T | undefined)`.
`GameCards.getProjectCards()` and `getPreludeCards()` call it after their existing custom-card
step (two one-line hooks in `GameCards.ts`). Banned names are skipped. The helper instantiates
extra copies with `newProjectCard`/`newPrelude`, so the `Card` static property cache
(`Card.ts:90`) is shared and cheap.

Duplicate-safety audit (the real work of this feature). Code paths that look cards up by name
must tolerate duplicates:
- `Player.playCard` removes by `findIndex(name)` (`Player.ts:880`) — removes one copy: OK.
- `SelectCard`/`SelectProjectCardToPlay` resolve responses by name — picks the first matching
  copy; acceptable because copies are interchangeable in hand.
- `PlayedCards` (`player.playedCards.get(name)`) returns the first copy; effects that target
  "the card named X" (e.g. Self-Replicating Robots, Robotic Workforce copy) act on the first.
  Documented limitation, not a bug for duplicate-friendly play.
- `CardModel` keys in Vue lists: `PlayerHome.vue` uses `:key="card.name"`; duplicates would
  collapse. The client-side fix is to key on `name + index` in the hand/tableau loops (small
  hook) — Vue warns on duplicate keys but still renders, so this is a polish item.
- Deck serialization is by name (`Deck.ts:150`), so duplicates round-trip.

**Client.** `src/client/components/custom/CardCopiesEditor.vue`: the `CardsFilter` search UX
(reuse its list source, filtered to project cards and preludes) with a number input per row.
It lives inside the `<CustomGameSettings>` panel on the new-game form and emits `cardCopies`.
`JSONProcessor` needs no change: `cardCopies` is a model field, so it passes through.

**Upstream hooks.** `NewGameConfig.ts`, `GameOptions.ts`, `ApiCreateGame.ts`, `GameCards.ts`
(2 lines), `CreateGameModel.ts`/`defaultCreateGameModel.ts`/`CreateGameForm.vue`
(field + serialize + panel), `PlayerHome.vue` (list keys).

## Deviations found while building

- `PlayedCards` (`src/server/cards/PlayedCards.ts`) rejected a second card with the same name, so
  a player could never play both copies. `push` now accepts copies (`get(name)` keeps returning
  the first) and `remove` re-points the name index at a remaining copy. Both changes are marked
  `CUSTOM(card-pools)` and covered by `tests/custom/deck/duplicatesInPlay.spec.ts`.
- List keys were changed in `StackedCards.vue`, `SortableCards.vue`, `SelectCard.vue` and
  `SelectProjectCardToPlay.vue` as well as `PlayerHome.vue`, since all of them render hands or
  tableaus that can now hold copies.
- Selecting cards in the UI is still by name, so two copies cannot be selected together in one
  prompt (for example selling both at once); selling one at a time works.

## Execution tasks

Build:
1. Types and option plumbing (`cardCopies`).
2. `addCardCopies` helper and the two `GameCards.ts` hooks.
3. `CardCopiesEditor.vue` inside the shared `CustomGameSettings.vue` panel; serialize into
   the config; default in `defaultCreateGameModel`.
4. Duplicate-safe keys in `PlayerHome.vue` hand and tableau loops.
5. Docs: limitations with name-targeting effects.

Test:
- Unit (server): `tests/custom/deck/cardCopies.spec.ts` — copies added, count 1 ignored, banned
  skipped, unknown name ignored, cap at 10, out-of-expansion card added.
- Unit (server): `tests/custom/deck/duplicatesInPlay.spec.ts` — `testGame(2)`, put two
  `Birds` in hand, play both, add resources to each, assert independent `resourceCount`;
  sell patents with duplicates in hand.
- Unit (client): `CardCopiesEditor.spec.ts` — add card, set count, remove, emits.
- Integration: `tests/custom/integration/cardPoolGame.spec.ts` — `Game.newInstance` with
  `cardCopies`, assert deck composition and that `game.projectDeck.drawPile` size grew by the
  right amount; serialize/deserialize the game and re-assert.
- Manual: new game with 3× a cheap card, confirm the sidebar deck count and that both copies can
  be played from a hand.
