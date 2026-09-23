# Feature 2: Custom card workshop

## Feature description

A page at `/workshop` where anyone in the group designs a card by filling in a form: name,
kind (automated, active, event, corporation, prelude, or colony), cost, tags, requirements,
what it does when played, an optional repeatable action, victory points, and an uploaded
picture. The form shows a live preview drawn with the site's own card renderer, so the card
looks like every other card in play. Saved cards are stored on the server and appear on the
new-game page in a "Workshop cards" list; the host ticks the ones to include, and they are
shuffled into the right deck (project deck, corporation pool, prelude pool, or colony tiles)
for that game.

The effect editor is preset-based: it offers the building blocks the engine already supports
declaratively (production, resources, terraform rating, temperature/oxygen/venus steps, draw
cards, place a city/greenery/ocean, add resources to the card, remove plants or resources from
an opponent, decrease an opponent's production, spend resources before an action). Anything
outside those blocks is out of scope for the workshop; such cards are written in code like
upstream cards. Colonies use the same idea with three benefit rows (build, trade, colony
bonus) chosen from resource/production/card-resource/TR/cards.

## Requirements and user stories

- **W-1** As a designer, I can open `/workshop`, pick a kind, fill in the form, see the card
  preview update as I type, and save it under a unique name.
- **W-2** As a designer, I can upload a picture (PNG/JPEG/WebP, resized client-side to fit the
  card, ≤ 400 KB) that is shown in the card's content area; the card still shows its icons and
  text.
- **W-3** As a designer, I can express: cost, tags, global-parameter and tag requirements
  (min or max), production changes, resource gains, TR, temperature/oxygen/venus steps, draw
  cards, tile placement (city/greenery/ocean), card resources with a resource type, opponent
  plant/resource/production removal, fixed or scaling VP, a repeatable action with an optional
  price, starting M€ for corporations and preludes, and a card discount.
- **W-4** As a designer, I can design a colony: name, planet picture, build bonus (per slot),
  trade bonus (per track position), and colony bonus.
- **W-5** As a designer, I can edit or delete my saved cards, and export/import a card as
  JSON to share outside the site.
- **W-6** As a host, on the new-game page I can tick workshop cards to include; they are listed
  with their kind and a preview on hover.
- **W-7** As a player, workshop cards play by the normal rules: requirements gate them, costs
  are paid, effects resolve through the engine, actions are once per generation, VP count at
  game end, and they can be banned, included, queued, or given extra copies like other cards.
- **W-8** As a player, a workshop card in a running game keeps working even if it is edited
  later (the game keeps the version it started with).
- **W-9** A workshop card cannot reuse the name of an existing card; names are 1–40
  characters; effects are clamped to engine-supported ranges (e.g. temperature −2..+3).
- **W-10** The `/cards` list page shows workshop cards under a "Workshop" module.

Acceptance criteria:
- Saving an automated card "+2 M€ production, +1 TR, cost 10, requires 2 science tags" and
  including it in a game: the card is in the deck, unplayable without two science tags,
  playable with them, and after play M€ production and TR are up and the cost was paid.
- An active card with "spend 1 resource here → +2 M€" shows in the actions list once per
  generation once it has a resource.
- A corporation with starting M€ 45 and an action appears in the initial corporation deal when
  included and its action works from generation 1.
- A workshop colony appears among the game's colonies and pays its bonuses on build and trade.
- The preview matches the card rendered in game (same `ClientCard` data).

## Proposed design

**Data.** `src/common/custom/CustomCardDefinition.ts` (already drafted): `id`, `name`,
`kind`, `description`, `image`, `cost`, `tags`, `requirements: Array<CustomRequirement>`,
`effect: CustomEffect`, `action: CustomEffect`, `resourceType`, `victoryPoints`,
`startingMegaCredits`, `cardDiscount`, `colony: CustomColonyDefinition`. Stored in namespace
`cards` keyed by `id = slugify(name)`. The definition is pure data so it can be exported,
imported and validated in one place (`validateCustomCard.ts`, shared by client and server).

**Server runtime.** `src/server/custom/cards/`:
- `compileCustomCard.ts` (drafted): definition → `StaticCardProperties` (behavior DSL,
  requirement descriptors, `CountableVictoryPoints`, metadata) and `renderCustomCard.ts`
  (drafted): definition → `ICardRenderRoot` built from `CardRenderItem`/`CardRenderSymbol`,
  bypassing `CardRenderer.builder`'s live-server short-circuit (`CardRenderer.ts:20-32`).
- `CustomCards.ts`: `CustomProjectCard extends Card`, `CustomActiveCard` (adds
  `canAct`/`action` via `getBehaviorExecutor`, exactly like `ActiveCorporationCard`),
  `CustomCorporation extends ActiveCorporationCard`, `CustomPrelude extends PreludeCard`.
  Each constructor takes the definition and calls `super(compileCustomCard(def))`.
- `CustomColony.ts`: `extends Colony`, mapping the three benefit rows to `ColonyBenefit`
  (`GAIN_RESOURCES`, `GAIN_PRODUCTION`, `ADD_RESOURCES_TO_CARD`, `GAIN_TR`, `DRAW_CARDS`).
- `CustomCardRegistry.ts`: singleton loaded from the store at startup; `register(def)`
  (evicts the `Card` static property cache for that name via a new
  `evictCardProperties(name)` export in `Card.ts`, two lines), `unregister`, `newCard(name)`,
  `colonyFactories(ids)`, `clientCards()` (produces `ClientCard`s the same way
  `export_card_rendering.ts:92-119` does, with `module: 'custom'`), `clientColonies()`.
- W-8 (running games keep their version): every game snapshot embeds the definitions of the
  workshop cards it uses: `GameOptions.customCardDefinitions` is filled at creation from the
  registry, serialized with the game, and on deserialize those definitions are registered
  under a game-scoped name lookup first. Concretely `newCard` fallback order is: upstream
  manifests → definitions embedded in the game being deserialized → registry. This costs one
  optional field on `GameOptions` and a context variable set by `Game.deserialize` (via the
  existing `gameOptions` object passed around, no new upstream parameter).

**Deck integration.** `GameOptions.customCards: Array<string>` (ids). `GameCards.getProjectCards/
getCorporationCards/getPreludeCards` each add the registry's cards of the matching kind for
those ids (one line each, shared with feature 4's hook). `ColonyDealer` concatenates
`registry.colonyFactories(ids)` to its tile list and `ColonyDeserializer` falls back to the
registry. `createCard._createCard` falls back to `registry.newCard` (one line), which covers
`cardsFromJSON`, `includedCards`, bans, copies and the action queue for free. Client card
lookups (`getCardOrThrow`) are satisfied by registering `clientCards()` into the client
manifest at app start (`loadCustomContent()` awaited in `App.vue mounted()` before the screen
is chosen; the manifest gains `addClientCards()`/`addColonies()` exports).

**Client.** `src/client/components/custom/workshop/`:
- `Workshop.vue` (page): list of saved cards (search, kind filter, edit/delete/export), and the
  editor.
- `CardEditor.vue`: kind selector; common fields; `EffectEditor.vue` (rows of typed building
  blocks with number inputs, reused for effect and action); `RequirementsEditor.vue`;
  `VictoryPointsEditor.vue`; `ImageUpload.vue` (canvas resize to 300×200, JPEG/WebP encode,
  size check); `ColonyEditor.vue` for the colony kind.
- Live preview: the editor posts the draft to `POST api/custom/cards/preview`, which returns
  the `ClientCard` (or `ColonyMetadata`) compiled by the server; the preview component
  registers it in the client manifest under the draft name and renders `<Card>` (or
  `<Colony>`). Debounced at 300 ms. Using the server for compilation keeps one source of truth
  for rendering.
- Picture on the card: `ClientCard.metadata` gains an optional `image` (data URL);
  `Card.vue` renders `<CustomCardArt v-if="cardInstance.metadata.image">` between the title and
  content (one element, one import). Colony pictures use an inline `background-image` style on
  `Colony.vue` when `metadata.image` is set (one binding).
- New-game page: `WorkshopCardsFilter.vue` in the shared `CustomGameSettings.vue` panel: the
  registry list with checkboxes, kind badges, hover preview.
- `/cards` page: `CardList.vue` gains a "Workshop" module entry if the registry has cards
  (one line in its module list).

**API.** `GET api/custom/cards` (all definitions without images, plus a `?full=1` variant),
`GET api/custom/cards?id=`, `POST api/custom/cards` (save; validates; rejects names that collide
with `CardName` values or `CARD_RENAMES`), `POST api/custom/cards/delete`, `POST
api/custom/cards/preview`, `GET api/custom/client-cards` (compiled `ClientCard`s and colony
metadata for the client manifest).

**Upstream hooks.** `paths.ts`, `requestProcessor.ts`, `App.vue` (screen + preload),
`Card.ts` (cache eviction), `createCard.ts`, `GameCards.ts`, `ColonyDealer.ts`,
`ColonyDeserializer.ts`, `GameOptions.ts`/`NewGameConfig.ts`/`ApiCreateGame.ts`,
`ClientCardManifest.ts`, `ClientColonyManifest.ts`, `Card.vue`, `Colony.vue`,
`CardMetadata.ts` (+1 optional field), `CardList.vue`, `GameModule.ts` (+ `'custom'` module
name), `CreateGameForm.vue` (shared panel), `server.ts` (registry load).

**Edge cases.** Deleting a card used by a running game: the game keeps its embedded
definition (W-8). Renaming: treated as a new card; the old id is deleted explicitly. Image
too large: rejected client-side and server-side. Card with an action but kind
"automated": the action is ignored and the editor warns. Preview name collides with a real
card: preview uses a `[draft] ` prefix in the manifest key and the server never stores it.

## Execution tasks

Build (in this order, each with its tests before moving on):
1. Validation module (`validateCustomCard.ts`) and the compiler/renderer (drafted) with
   `CustomCards.ts`, `CustomColony.ts` runtime classes.
2. Registry, `Card.ts` eviction hook, `createCard.ts`/colony fallbacks, embedded definitions
   in `GameOptions` for W-8.
3. Deck integration (`customCards` option, `GameCards.ts`, `ColonyDealer.ts`).
4. API routes (list/get/save/delete/preview/client-cards).
5. Client manifest registration and app preload; `Card.vue`/`Colony.vue` picture hooks;
   `GameModule` `'custom'`; `/cards` page entry.
6. Workshop page and editors; image upload; export/import.
7. New-game `WorkshopCardsFilter`.
8. Docs and a handful of example definitions in `docs/custom/examples/`.

Test:
- Unit (server): `compileCustomCard.spec.ts` — every building block maps to the expected
  behavior/requirement/VP shape; clamping; empty effect yields no behavior.
- Unit (server): `renderCustomCard.spec.ts` — rows produced for production, action, gains,
  tiles; empty definition renders an empty root.
- Unit (server): `CustomCards.spec.ts` — using `testGame`: requirements gate `canPlay`;
  `play` applies production/stock/TR/global steps; active card action once per generation and
  `canAct` false without the price; corporation starting M€ and action; prelude plays from
  `preludeCardsInHand`; scaling VP counts resources/tags.
- Unit (server): `CustomColony.spec.ts` — build/trade/colony bonuses for each benefit kind.
- Unit (server): `CustomCardRegistry.spec.ts` — register/unregister/newCard; re-register with
  changed cost is visible on a new instance (cache eviction); load from `MemoryCustomStore`.
- Unit (server): `validateCustomCard.spec.ts` — name collision with `CardName`, length,
  image size, kind/field consistency.
- Route: `ApiCustomCards.spec.ts` — CRUD, preview returns a `ClientCard`, delete of a missing
  id is a 404, save rejects invalid definitions with messages.
- Integration: `tests/custom/integration/workshopGame.spec.ts` — register a project card, a
  corporation, a prelude and a colony; `Game.newInstance` with `customCards` including all four
  in a 2-player colonies+prelude game; assert deck/pool/colony membership; deal, select, play
  each; serialize → deserialize → play the active card's action; then unregister everything
  from the registry and deserialize again to prove the embedded definitions keep the game
  working (W-8).
- Unit (client): `Workshop.spec.ts` (renders list from mocked fetch), `CardEditor.spec.ts`
  (emits a valid definition; kind switch shows/hides sections), `EffectEditor.spec.ts`,
  `ImageUpload.spec.ts` (rejects oversized), `WorkshopCardsFilter.spec.ts`.
- Manual: design a card with a picture in the browser; confirm the preview; include it in a
  game and play it; edit its cost afterwards and confirm the running game is unchanged while a
  new game sees the new cost.
