# Feature 1: Game presets

## Feature description

A preset is a named, server-stored new-game configuration: expansions, board, variants, banned
and included cards, custom corporation/prelude/colony lists, timers, and (optionally) the player
roster. Anyone in the group opens the new-game page, picks a preset from a dropdown, and the
whole form fills in. Presets are shared by everyone on the server, so "our Tuesday rules" or
"no Turmoil, bans list v3" is defined once and used by whoever hosts.

The site already has a per-browser "last settings" restore and JSON upload/download
(`CreateGameForm.vue`, `CreateGameSettingsStorage.ts`, `JSONProcessor.ts`). Presets build on
that machinery: a preset *is* the same `NewGameConfig` JSON, but stored on the server under a
name instead of in one person's browser or a file they have to send around.

## Requirements and user stories

- **P-1** As a host, I can save the current form as a preset with a name and optional
  description, so the group's standard setup and bans are captured once.
- **P-2** As a host, I can load a preset from a dropdown on the new-game page and every field
  it contains is applied, including banned/included cards and custom lists.
- **P-3** As a host, I can choose whether loading a preset replaces the player list or keeps
  the players I already typed in (default: keep players).
- **P-4** As a host, I can overwrite an existing preset by saving under the same name, and
  delete a preset, with a confirmation.
- **P-5** As a host, I can see which preset is loaded and whether the form has been changed
  since loading it ("Tuesday rules (modified)").
- **P-6** As any player, I can see the preset name a game was created with on the game's
  setup detail, so bans can be checked at the table.
- **P-7** A preset saved on an older version of the site still loads, with the same warnings the
  JSON upload shows today for unknown or renamed fields.
- **P-8** Presets are limited to a sensible size (100 KB) and count (200) to keep the store
  healthy; names are 1–60 characters.

Acceptance criteria:
- Saving then reloading the page and choosing the preset reproduces the form exactly (verified
  by comparing `serializeSettings()` output, ignoring `seed` and `clonedGamedId`).
- Loading a preset with "keep players" leaves names, colors, handicaps, first-player untouched.
- The game created from a preset records `presetName` in its `GameOptions` and it shows in the
  setup detail panel.
- Deleting requires a confirm dialog; the dropdown updates without a page reload.

## Proposed design

**Data.** `src/common/custom/GamePreset.ts`:

```ts
type GamePreset = {id: string; name: string; description?: string; author?: string; updatedAt: number; config: NewGameConfig};
type GamePresetRequest = {op: 'save', name, description?, author?, config} | {op: 'delete', id};
```
`id` is `slugify(name)`. Stored in namespace `presets`, one entry per id.

**Server.** `src/server/custom/routes/ApiPresets.ts` (`GET api/custom/presets` lists; `POST`
saves or deletes). Validation: name length, body size (reuse `readBody` limit), `config.players`
is an array, card names validated via `CardName` set with `CARD_RENAMES` warnings returned in
the response. No authentication (the site is private to the group); if the server has Discord
login configured, the saving user's Discord name is recorded as `author`.

`GameOptions` gains `presetName?: string` (also on `NewGameConfig` and copied in
`ApiCreateGame.ts`). `GameOptionsModel` exposes it so `GameSetupDetail.vue` can print it. This
is the one place a preset touches the game itself.

**Client.** `src/client/components/custom/PresetBar.vue`, embedded at the top of the new-game
form's action area:
- dropdown of presets (fetched on mount), "Load", "Save as…", "Delete";
- a "Keep current players" checkbox (default on);
- a status line: loaded preset name + "(modified)" flag driven by a deep watch on the model.

Loading reuses `CreateGameForm.applySettings(json)` exactly as the JSON upload path does
(`CreateGameForm.vue:757`), so the existing warning dialog and field mapping apply. When
"keep players" is on, the preset's `players` are replaced by the current form's players before
`applySettings` runs. Saving calls `serializeSettings()` (so the same validations run as when
creating a game), strips `seed` and `clonedGamedId`, and posts.

**Upstream hooks.** `paths.ts` (+1 path), `requestProcessor.ts` (via `customHandlers`),
`CreateGameForm.vue` (import + `<PresetBar>` element + expose `applySettings`),
`NewGameConfig.ts`/`GameOptions.ts`/`ApiCreateGame.ts`/`GameOptionsModel.ts`/`ServerModel.ts`
(+1 optional field each), `GameSetupDetail.vue` (+1 line).

**Edge cases.** Preset referencing a card that no longer exists → warning, card dropped
(existing `JSONProcessor` behavior). Two hosts saving the same name → last write wins (store
upsert). Preset with 4 players loaded into a form showing 2 → `playersCount` is updated by
`JSONProcessor` unless "keep players" is on.

## Execution tasks

Build:
1. Types (`GamePreset.ts`) and `ApiPresets` route with validation; register the path.
2. `presetName` plumbing through `NewGameConfig` → `ApiCreateGame` → `GameOptions` →
   `GameOptionsModel` → `GameSetupDetail.vue`.
3. `PresetBar.vue` with load/save/delete, keep-players option, modified indicator.
4. Embed in `CreateGameForm.vue`; call `createGameSettingsStorage.saveSettings` unchanged.
5. Document in `CUSTOM.md` (where presets are stored, how to back them up: copy `db/custom/presets`).

Test:
- Unit (server): `tests/custom/routes/ApiPresets.spec.ts` — list empty, save then list, overwrite,
  delete, reject bad name, reject oversized body, unknown card warnings returned.
- Unit (server): `tests/custom/game/presetName.spec.ts` — `Game.newInstance` keeps `presetName`
  and it survives serialize/deserialize.
- Unit (client): `tests/client/components/custom/PresetBar.spec.ts` — renders list from a
  mocked `fetch`, emits `load` with players replaced/kept, shows modified flag.
- Integration: `tests/custom/integration/presetRoundTrip.spec.ts` — build a `NewGameConfig`
  with bans and custom lists, save via route, load via route, run it through `JSONProcessor`
  against a fresh `defaultCreateGameModel()` and assert equality of the relevant fields.
- Manual: create preset with bans on `/new-game`, reload page, load it, create a game, confirm
  banned cards are absent from `/cards`-style debug (`game.projectDeck`) and the preset name is
  on the setup detail.
