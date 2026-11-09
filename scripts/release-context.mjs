import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// Tie evidence to executable source; documentation-only commits do not invalidate it.
export function releaseContext() {
  const files = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' })
    .split('\0').filter((path) => /^(backend|frontend|database|deployment|tests|scripts|\.github)\/|^(Dockerfile|railway\.toml|\.dockerignore)$/.test(path))
    .filter((path) => !/\.md$/.test(path));
  const hash = createHash('sha256');
  for (const path of [...new Set(files)].sort()) hash.update(path + '\0').update(readFileSync(path)).update('\0');
  return { source_commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), source_sha256: hash.digest('hex') };
}
