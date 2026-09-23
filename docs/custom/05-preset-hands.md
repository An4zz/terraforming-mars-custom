# Feature 5: Preset hands

## Feature description

Normally each player is dealt 10 random project cards, a set of corporations, and (with the
expansions) preludes and CEOs. This feature lets the host fix that initial deal: everyone
receives the same chosen starting cards, corporation choices, preludes and CEOs. It is meant
for standardized "same start" games, teaching games, and replaying a known opening. Lists
shorter than the normal deal are topped up randomly, so a host can fix five cards and let the
other five vary.

## Requirements and user stories

- **PH-1** As a host, on the new-game page I can pick the project cards, corporations, preludes
  and CEOs every player starts with; each list is optional.
- **PH-2** As a player, I see the preset cards in my initial selection exactly like a normal
  deal, and I still choose which to keep and buy.
- **PH-3** If a list is shorter than the normal deal (10 projects, `startingCorporations`
  corps, `startingPreludes`, `startingCeos`), the remainder is drawn from the deck as usual.
- **PH-4** Preset cards are given to every player even if that means several players hold the
  same corporation or the same project; the deck copy of a preset project card is removed so it
  is not drawn a third time.
- **PH-5** Initial draft (project, prelude, CEO) is turned off for any category that has a
  preset list, and the form says so.
- **PH-6** Preset hands are part of the settings JSON and presets.
- **PH-7** Beginner corporation players are unaffected (they skip the deal today and keep
  doing so).

Acceptance criteria:
- With `presetHands.projectCards = [A, B, C]` in a 3-player game, each player's
  `dealtProjectCards` starts `[A, B, C]` followed by 7 random cards, and the deck no longer
  contains A, B or C.
- With `presetHands.corporations = [Helion]`, each player's corporation choice includes Helion;
  with `startingCorporations: 2`, one more random corp is offered.
- Turning on the initial draft while a project preset exists shows a warning and the game is
  created with `initialDraftVariant: false`.

## Proposed design

**Data.** `PresetHands = {projectCards?, corporations?, preludes?, ceos?}` in
`src/common/custom/CustomGameOptions.ts`; `presetHands?: PresetHands` on `NewGameConfig` and
`GameOptions`, copied in `ApiCreateGame.ts`.

**Server.** `src/server/custom/deck/presetHands.ts` exports
`applyPresetHands(game, player, decks)`. It is called once per player from the dealing loop in
`Game.newInstance` (`Game.ts:396-436`) right after the normal `drawN` calls. For each list
that is present: create one fresh instance per preset name (`newProjectCard`,
`newCorporationCard`, `newPrelude`, `newCeo`), remove the same-named cards from the deck's
draw pile (once, the first time), and replace the dealt array with `[...preset, ...dealt]`
trimmed to the normal deal size, returning any surplus random cards to the bottom of the draw
pile. `ApiCreateGame` sets `initialDraftVariant`, `preludeDraftVariant`, `ceosDraftVariant`
to false for the corresponding categories when a preset list is present (server-enforced; the
UI mirrors it).

`Game.newInstance` runs `Game.log` for solo games; the preset application logs one line
"Preset hands in effect" for transparency.

**Client.** `src/client/components/custom/PresetHandsEditor.vue` in the shared
`CustomGameSettings.vue` panel: four searchable lists (reusing the `CardsFilter` pattern with
type filters: project cards; corporations; preludes; CEOs) each showing chosen cards with
remove buttons. A note under each list explains topping-up and the draft interaction. When a
project preset exists and `initialDraft` is checked, the form shows an inline warning.

**Upstream hooks.** `NewGameConfig.ts`, `GameOptions.ts`, `ApiCreateGame.ts`, `Game.ts`
(1 call), `CreateGameModel.ts`/`defaultCreateGameModel.ts`/`CreateGameForm.vue`.

**Edge cases.** Preset name not found → warn and skip. Preset corporation also in
`customCorporationsList` → fine, just dealt first. Solo game: the same rules apply. Two Corps
variant: preludes list still applies; Merger is added by `SelectInitialCards` as today.

## Execution tasks

Build:
1. Types and option plumbing (`presetHands`), including the draft-flag override in
   `ApiCreateGame.ts`.
2. `applyPresetHands` with deck removal/return logic; hook in `Game.ts`.
3. `PresetHandsEditor.vue` with four lists; draft warning; serialize; defaults.
4. Docs.

Test:
- Unit (server): `tests/custom/deck/presetHands.spec.ts` — full list replaces deal; short list
  tops up; deck copy removed; surplus returned to bottom; unknown names skipped; corporations
  duplicated across players; beginner player untouched.
- Unit (server): `tests/custom/routes/ApiCreateGamePresetHands.spec.ts` — draft flags forced
  off when lists are present.
- Unit (client): `PresetHandsEditor.spec.ts` — add/remove per list, emits, draft warning shows.
- Integration: `tests/custom/integration/presetHandsGame.spec.ts` — `Game.newInstance` with all
  four lists in a 3-player prelude+CEO game, run `SelectInitialCards` for each player choosing
  the preset cards, assert hands and tableau; serialize/deserialize before selection and
  re-assert the dealt arrays.
- Manual: create a 2-player game with a 3-card project preset; both players see the same first
  three cards in the starting selection.
