import assert from 'node:assert/strict';
import {
  isRuntimeOnlyEnginePath,
  meaningfulEnginePaths,
} from './x-submodule-change-filter.mjs';

const runtimeOnly = [
  'hits.json',
  'hits.md',
  'status.json',
  'docs/hits.json',
  'docs/hits.md',
  'docs/status.json',
  'data/log/2026-09-22.jsonl',
  'data/notify_state.json',
  'data/training_snapshots.jsonl',
  'data/training_snapshots/part-000001.jsonl',
  'data/training_snapshots/part-000123.jsonl',
  'data/training_outcomes.json',
  'data/watchlist.json',
  'data/model_registry.json',
  'keywords.txt',
  'keywords_combo.txt',
  'keywords_ng.txt',
  'docs/keywords.txt',
];

for (const path of runtimeOnly) {
  assert.equal(isRuntimeOnlyEnginePath(path), true, path);
}

const meaningful = [
  'main.py',
  'growth.py',
  'detector.py',
  'watchlist.py',
  'data/impression_model.json',
  '.github/workflows/monitor.yml',
  'tests/test_pipeline.py',
];

for (const path of meaningful) {
  assert.equal(isRuntimeOnlyEnginePath(path), false, path);
}

assert.deepEqual(
  meaningfulEnginePaths([
    'hits.json',
    'data/log/2026-09-22.jsonl',
    'data/model_registry.json',
    'main.py',
    'data/impression_model.json',
  ]),
  ['main.py', 'data/impression_model.json'],
);

console.log('✅ X-Bunseki runtime-only submodule filtering passed');
