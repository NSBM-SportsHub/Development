import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

// Tie evidence to executable source; documentation-only commits do not invalidate it.
export function releaseContext() {
  const files = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' })
    .split('\0').filter((path) => /^(backend|frontend|database|tests|scripts|\.github)\//.test(path))
    .filter((path) => !/\.md$/.test(path) && existsSync(path));
  const hash = createHash('sha256');
  for (const path of [...new Set(files)].sort()) {
    const content = readFileSync(path);
    // Git archives use LF while Windows worktrees may use CRLF. Normalize known
    // text source so the evidence also identifies the extracted source archive.
    const text = /\.(?:php|py|txt|jsx?|mjs|cjs|json|sql|css|toml|ya?ml|sh|html|htaccess|gitkeep)$/.test(path);
    hash.update(path + '\0').update(text ? content.toString('utf8').replaceAll('\r\n', '\n') : content).update('\0');
  }
  return { source_commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), source_sha256: hash.digest('hex') };
}
