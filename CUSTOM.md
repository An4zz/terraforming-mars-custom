# This fork

This repository is a custom fork of
[terraforming-mars/terraforming-mars](https://github.com/terraforming-mars/terraforming-mars)
for a private group. It tracks upstream `main` and adds features that upstream would not carry.

The plans for every custom feature, and the rules that keep the fork mergeable, are in
[`docs/custom/`](docs/custom/README.md). Read that first.

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

## Syncing with upstream

```
scripts/sync-upstream.sh          # fetch upstream/main and merge it into the current branch
```

A weekly GitHub Actions workflow opens a pull request with the same merge. When it conflicts,
resolve locally: the conflicts will be in the hook files listed in `docs/custom/README.md`.
