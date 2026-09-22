# X-Bunseki integration / GPT-6 Astra handoff

Last updated: 2026-09-22

## Responsibility boundary

- X-Bunseki remains the independent X monitoring, prediction, watchlist and learning engine.
- Tiktok-generater-Public owns the integrated timeline/detail UI, status UI and administrator keyword UI.
- `X-Bunseki/` is a Git submodule for source/model sharing only.
- Runtime monitoring data is not copied through the submodule. The parent reads `hits.json`, `status.json`, `data/model_registry.json` and `data/impression_model.json` from X-Bunseki main.
- SQLite, Actions cache, watchlist state, training snapshots and X cookies remain engine-owned.

## Existing engine behavior preserved

SearchTimeline discovery, TweetDetail follow-up, observations SQLite, growth/acceleration, detector scoring, final-impression prediction, watchlist, 24h outcomes, Gen0/Gen1 separation, chronological validation, shadow evaluation and fail-closed promotion were preserved.

The existing watchlist already includes the requested 15, 30, 45, 60, 90, 120, 180, 240, 360, 720 and 1440 minute checkpoints, plus extra checkpoints.

## Public data contract

X-Bunseki `hits.json` schema_version 2 exposes two separate public lists. `early_posts` is the engine's early-discovery list (age <= 240 minutes and predicted final impressions >= 1,000,000), already ordered by predicted final impressions. `trending_posts` is the actively viral list (240 < age <= 1440 minutes and current impressions >= 1,500,000), already ordered by impressions/minute and then current impressions. `posts` is only a backwards-compatible alias of `early_posts`; the parent must never merge it with `trending_posts` into one ranking.

## Keyword administration

The old browser-direct Cloudflare Worker write path is not used by the parent integration.

Flow: `/admin` (and the legacy `/admin/x-monitor` view) -> existing Supabase session + ADMIN_EMAILS -> Server Action re-check -> server-only GitHub Contents API -> existing `keywords.txt`, `keywords_combo.txt`, or `keywords_ng.txt` -> next X-Bunseki monitor run.

Required hosting secret: `X_BUNSEKI_GITHUB_TOKEN`.
Create a GitHub fine-grained token scoped only to `mnaoki20081106-afk/X-Bunseki` with repository permission `Contents: Read and write`. Do not prefix it with `NEXT_PUBLIC_`.

## Submodule sync

`.github/workflows/sync-x-bunseki.yml` checks X-Bunseki main every 15 minutes. It deliberately ignores runtime-only changes to hits/status, docs copies, `data/log/**`, notify state, training snapshots/outcomes and watchlist. Source/workflow/model changes advance the parent Gitlink and commit the new pointer.

## Parent routes

- `/x-monitor`: read-only X-Bunseki monitor view. The UI defaults to `早期発見` and switches in-place between `早期発見` and `🔥 バズっている`, matching the source `docs/index.html` behavior.
- `/x-monitor` and `/x-monitor/[id]` refresh their Server Component data every 15 minutes while open, and refresh on return/focus when the last client refresh is 15+ minutes old. Runtime JSON fetches are `no-store` with a cache-busting query parameter.
- `/x-monitor/[id]`: post detail metrics.
- `/admin/x-monitor`: admin-only keywords and model status.

## Tests

Parent CI checks out submodules recursively and runs `npm test`, `npm run lint`, and `npm run build`. X-Bunseki engine changes passed its existing Tests workflow before merge.

## Astra continuation rules

Do not copy X-Bunseki source into the parent. Keep runtime JSON separate from the submodule. Keep keyword writes server-only. Never expose X auth_token, ct0, GitHub token or Supabase service-role key. Preserve shadow-first fail-closed model promotion. Keep runtime-only monitor commits from churning the parent submodule pointer.
