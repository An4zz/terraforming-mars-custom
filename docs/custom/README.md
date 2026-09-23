# Custom fork: plan overview

This folder holds the plans for the custom features of this fork. Each feature has its own
document with four sections: **feature description**, **requirements and user stories**,
**proposed design**, and **execution tasks** (build tasks and test tasks). Nothing in a plan is
built until the plan is approved.

| # | Feature | Plan | Status |
|---|---------|------|--------|
| 0 | Fork foundation (upstream sync, isolation rules, shared store) | this file, below | built |
| 1 | Game presets | [01-game-presets.md](01-game-presets.md) | built |
| 2 | Custom card workshop | [02-card-workshop.md](02-card-workshop.md) | planned |
| 3 | Action queue | [03-action-queue.md](03-action-queue.md) | built |
| 4 | Custom card pools (duplicates) | [04-card-pools.md](04-card-pools.md) | built |
| 5 | Preset hands | [05-preset-hands.md](05-preset-hands.md) | built |
| 6 | Discord turn notifications | [06-discord-notifications.md](06-discord-notifications.md) | built |

Hosting the fork, including the Discord integration, is described in [hosting.md](hosting.md).

Suggested build order: 0, 1, 4, 5, 6, 3, 2. Presets, card pools and preset hands share the
new-game form work and are small. Discord notifications and the action queue share the
turn-start hook. The workshop is the largest and benefits from everything before it (its cards
are picked on the new-game form and can be queued).

---

## 0. Fork foundation

### Feature description

The fork must keep taking upstream releases from `terraforming-mars/terraforming-mars` while
carrying its own features indefinitely. That only stays cheap if custom code lives in its own
files and touches upstream files through a handful of small, clearly marked hooks. This section
defines those rules, the sync procedure, and the one shared piece of infrastructure every
feature needs: a place to store data that is not a game (presets, workshop cards, Discord
opt-ins).

### Requirements and user stories

- **F0-1** As a maintainer, I can pull the latest upstream `main` into this fork with one
  command and expect conflicts only in a short, known list of hook files.
- **F0-2** As a maintainer, I can see at a glance which upstream files the fork modifies and why
  (every hook is marked with a `// CUSTOM:` comment naming the feature).
- **F0-3** As a maintainer, I get a weekly pull request that merges upstream into the fork so
  updates are not forgotten.
- **F0-4** As a feature, I can persist small JSON documents by namespace and key, on every
  database backend the site supports (SQLite, PostgreSQL, local filesystem), without changing
  upstream database code.
- **F0-5** As a maintainer, the existing CI (`lint`, `build`, `test`) keeps passing after every
  feature, so upstream test suites keep guarding the fork.

### Proposed design

**Directory layout.** All new code goes under a `custom` folder in each layer:

| Layer | Location |
|-------|----------|
| shared types | `src/common/custom/` |
| server | `src/server/custom/` |
| client | `src/client/components/custom/`, `src/client/custom/` |
| styles | `src/styles/custom.less` (imported once from `common.less`) |
| server tests | `tests/custom/` |
| client tests | `tests/client/components/custom/` |

**Upstream hook policy.** Each upstream file may be touched only by (a) an import of a custom
module and (b) a one-line call, guarded by `// CUSTOM(<feature>):`. The expected hook files
across all six features, with the reason, are listed in each plan and summarized here:

| Upstream file | Reason |
|---------------|--------|
| `src/common/app/paths.ts` | new page and API paths |
| `src/server/server/requestProcessor.ts` | register custom route handlers |
| `src/client/components/App.vue` | new `workshop` screen |
| `src/common/game/NewGameConfig.ts`, `src/server/game/GameOptions.ts`, `src/server/routes/ApiCreateGame.ts` | three optional game options (workshop cards, card copies, preset hands) |
| `src/client/components/create/CreateGameForm.vue`, `CreateGameModel.ts`, `defaultCreateGameModel.ts` | one embedded `<CustomGameSettings>` panel and the preset bar |
| `src/server/GameCards.ts` | add workshop cards and extra copies to decks |
| `src/server/cards/PlayedCards.ts` | allow two copies of a card in a tableau |
| `src/client/components/StackedCards.vue`, `SortableCards.vue`, `SelectCard.vue`, `SelectProjectCardToPlay.vue` | list keys that tolerate copies |
| `src/server/Game.ts` | preset hands at dealing time |
| `src/server/Player.ts`, `src/server/SerializedPlayer.ts` | action queue field and two hooks (turn start, waiting-for) |
| `src/server/createCard.ts`, `src/server/colonies/ColonyDealer.ts`, `ColonyDeserializer.ts` | fall back to workshop cards and colonies |
| `src/server/cards/Card.ts` | evict a cached card definition when a workshop card is edited |
| `src/client/cards/ClientCardManifest.ts`, `src/client/colonies/ClientColonyManifest.ts` | register workshop cards on the client |
| `src/client/components/card/Card.vue` | show a workshop card's picture |
| `src/client/components/PlayerHome.vue` | one embedded `<CustomPlayerPanel>` (queue + Discord opt-in) |
| `src/server/server.ts` | initialize the custom store and registry at startup |

**Sync procedure.** `scripts/sync-upstream.sh` adds the `upstream` remote if missing, fetches
`upstream/main`, and merges it into the current branch. A GitHub Actions workflow
(`.github/workflows/sync-upstream.yml`) runs weekly, performs the merge on a branch
`upstream-sync/<date>`, and opens a pull request against `main`; conflicts fail the job with the
conflicting file list in the log so a maintainer resolves them locally. `CUSTOM.md` at the
repository root documents the procedure and the hook policy for future contributors.

**Custom store.** `src/server/custom/store/ICustomStore.ts` defines
`get/list/put/delete(namespace, key)` over JSON values. Two implementations:
`FileCustomStore` (one JSON file per key under `db/custom/<namespace>/`, used with SQLite and
local-filesystem databases) and `PostgresCustomStore` (a single `custom_kv` table, used when
`POSTGRES_HOST` is set, selected exactly as `Database.createInstance()` selects its backend). A
`MemoryCustomStore` serves tests. Keys are validated against `^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$`
so they are safe as filenames. Namespaces in use: `presets`, `cards`, `discord`.

**Route registration.** `src/server/custom/routes/customHandlers.ts` exports a list of
`[path, handler]` pairs that `requestProcessor.ts` spreads into its map. Every custom API lives
under `api/custom/...`; every custom page is served by the existing `ServeApp` handler.

### Execution tasks

Build:
1. Add `CUSTOM.md`, `scripts/sync-upstream.sh`, `.github/workflows/sync-upstream.yml`.
2. Add the custom store (interface, file, postgres, memory implementations, factory).
3. Add `customHandlers.ts` with a `GET api/custom/status` route returning feature flags and
   the store backend name, and register it (`paths.ts`, `requestProcessor.ts`).
4. Initialize the store in `server.ts` after the database.
5. Add `src/styles/custom.less` and import it.

Test:
- Unit: `tests/custom/store/FileCustomStore.spec.ts` (round trip, list, delete, bad key
  rejected, corrupt file skipped) against a temp directory; `MemoryCustomStore` shared suite.
- Integration: `tests/integration/PostgresCustomStore.spec.ts` under the existing
  `test:integration` job (table created, upsert overwrites, delete).
- Route: `tests/custom/routes/ApiCustomStatus.spec.ts` with `RouteTestScaffolding`.
- Manual: run `scripts/sync-upstream.sh` on a throwaway branch; confirm a clean merge today.
- CI: `npm run lint && npm run build && npm test` green.
