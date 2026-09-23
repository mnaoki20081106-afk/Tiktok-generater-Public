import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const RUNTIME_ONLY_PATTERNS = [
  /^(hits\.(json|md)|status\.json)$/,
  /^docs\/(hits\.(json|md)|status\.json)$/,
  /^data\/log\/.+$/,
  /^data\/(notify_state\.json|training_snapshots\.jsonl|training_outcomes\.json|watchlist\.json|model_registry\.json)$/,
  /^data\/training_snapshots\/part-\d{6}\.jsonl$/,
  /^keywords(_combo|_ng)?\.txt$/,
  /^docs\/keywords(_combo|_ng)?\.txt$/,
];

export function isRuntimeOnlyEnginePath(path) {
  return RUNTIME_ONLY_PATTERNS.some((pattern) => pattern.test(path));
}

export function meaningfulEnginePaths(paths) {
  return paths
    .map((path) => path.trim())
    .filter(Boolean)
    .filter((path) => !isRuntimeOnlyEnginePath(path));
}

const invokedAsScript =
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedAsScript) {
  const input = fs.readFileSync(0, 'utf8').split(/\r?\n/);
  const meaningful = meaningfulEnginePaths(input);
  if (meaningful.length) process.stdout.write(meaningful.join('\n') + '\n');
}
