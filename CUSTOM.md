# This fork

This repository is a custom fork of
[terraforming-mars/terraforming-mars](https://github.com/terraforming-mars/terraforming-mars)
for a private group. It tracks upstream `main` and adds features that upstream would not carry.

The plans for every custom feature, and the rules that keep the fork mergeable, are in
[`docs/custom/`](docs/custom/README.md). To run a server for your group, including the Discord
integration, follow [`docs/custom/hosting.md`](docs/custom/hosting.md).

## Rules of the fork

1. Custom code lives in `custom` folders (`src/common/custom`, `src/server/custom`,
   `src/client/components/custom`, `tests/custom`).
2. An upstream file may only gain an import plus a one-line call, marked
   `// CUSTOM(<feature>):`. Never restructure upstream code.
3. Every feature keeps `npm run lint`, `npm run build` and `npm test` green.
4. Upstream is merged, never rebased, so the shared history stays intact.

## Where custom data lives

Presets, workshop cards and Discord opt-ins are stored outside the game tables:

- with SQLite or the local filesystem database: JSON files under `db/custom/<namespace>/`
  (override the folder with `CUSTOM_STORE_DIR`). Back them up by copying that folder.
- with PostgreSQL: the `custom_kv` table in the game database.

`GET api/custom/status` reports which store is in use.

## Card workshop

`/workshop` designs project cards, corporations, preludes and colonies from building blocks
(production, resources, TR, global steps, cards, tiles, card resources, requirements, victory
points, an action with a price) plus a picture, with a live preview. Saved cards are ticked on
the new game page under "Custom pool" and then shuffled into the right deck. Example definitions
to import are in `docs/custom/examples/`. A running game keeps the version of a card it started
with; the workshop's current version is what the client draws.

## Card pools

The new game page's "Custom pool" panel sets how many copies of a project card or prelude are in
the deck. Copies are full cards with their own resources. Effects that look up a card by name act
on the first copy, and a selection prompt can pick only one copy at a time.

## Preset hands

The same panel sets the project cards, corporations, preludes and CEOs every player starts with.
Shorter lists are topped up at random; drafts are turned off for any category that has a list.

## Action queue

From the "Custom features" panel on the player page, queue actions (play a card, use a card
action, a standard project, claim a milestone, fund an award, convert heat, end turn, pass). They
run in order at the start of each of your turns, paying with megacredits first and then steel or
titanium where allowed, until one is no longer possible; then the queue stops and tells you why
(in the log, and on Discord if you opted in). Choices inside an action, such as where a tile
goes, are still yours; the queue continues after you answer.

## Discord turn notifications

Setting up the Discord application, bot and webhook is part of hosting the server: follow
[`docs/custom/hosting.md`](docs/custom/hosting.md) and run `npm run discord:check`. Each player then opts in from the "Custom features" panel on their
player page with their Discord user id. A player is told once per prompt, not while they are
actively playing, and at most once every 30 seconds. A server restart can repeat one message.

## Syncing with upstream

```
scripts/sync-upstream.sh          # fetch upstream/main and merge it into the current branch
```

A weekly GitHub Actions workflow opens a pull request with the same merge. When it conflicts,
resolve locally: the conflicts will be in the hook files listed in `docs/custom/README.md`.
