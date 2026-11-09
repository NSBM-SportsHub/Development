import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { releaseContext } from './release-context.mjs';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
assert.equal(git('status', '--porcelain'), '', 'Commit the reviewed source before packaging; local secrets and generated artifacts must remain ignored.');
const context = releaseContext();
const tracked = git('ls-files', '-z').split('\0').filter(Boolean);
for (const path of tracked) {
  assert.ok(!/(^|\/)(node_modules|\.tools|\.artifacts|\.git|dist)(\/|$)|(^|\/)\.env(?:$|\.(?!example$))|^backend\/config\/local\.php$|\.(?:log|sql\.gz|pem|key)$/.test(path), 'Private/generated file is tracked: ' + path);
}
const evidenceNames = ['browser-evidence.json', 'backup-restore-evidence.json'];
const reports = evidenceNames.map((name) => {
  const file = resolve('.artifacts', name);
  assert.ok(existsSync(file), 'Missing fresh evidence: ' + name);
  const report = JSON.parse(readFileSync(file, 'utf8'));
  assert.equal(report.status, 'passed', name);
  assert.equal(report.source_sha256, context.source_sha256, name + ' belongs to different executable source; rerun the suite.');
  assert.equal(report.synthetic_data_only, true, name);
  return report;
});
const output = resolve('.artifacts', 'submission-' + context.source_commit.slice(0, 7));
assert.ok(!existsSync(output), 'This package already exists; keep each release artifact immutable.');
mkdirSync(resolve(output, 'evidence'), { recursive: true });
const zip = resolve(output, 'SportsHub-source.zip');
git('archive', '--format=zip', '--prefix=SportsHub/', '--output=' + zip, 'HEAD');
const files = ['SportsHub-source.zip'];
for (const name of evidenceNames) {
  copyFileSync(resolve('.artifacts', name), resolve(output, 'evidence', name));
  files.push('evidence/' + name);
}
for (const path of reports[0].screenshots) {
  assert.match(path, /^\.artifacts\/(?:release-[a-z-]+|complete-(?:reports|competition|training-mobile))\.png$/);
  copyFileSync(path, resolve(output, 'evidence', basename(path)));
  files.push('evidence/' + basename(path));
}
const logNames = ['release-build.log', 'release-frontend.log', 'release-configuration.log', 'release-integration.log', 'release-browser.log', 'release-backup.log', 'release-layout.log'];
for (const name of logNames) {
  assert.ok(existsSync(resolve('.artifacts', name)), 'Missing release check log: ' + name);
  copyFileSync(resolve('.artifacts', name), resolve(output, 'evidence', name));
  files.push('evidence/' + name);
}
writeFileSync(resolve(output, 'manifest.json'), JSON.stringify({ ...context, packaged_at: new Date().toISOString(), source_archive: 'SportsHub-source.zip', source_files: tracked.length, evidence: files.filter((path) => path.startsWith('evidence/')), deployment: 'deferred by user', rubric_acceptance: 'awaiting official guideline', submission: 'not submitted', local_credentials_included: false }, null, 2) + '\n');
files.push('manifest.json');
writeFileSync(resolve(output, 'SHA256SUMS.txt'), files.map((path) => createHash('sha256').update(readFileSync(resolve(output, path))).digest('hex') + '  ' + path).join('\n') + '\n');
console.log('Created submission package: ' + output);
console.log('Includes committed source, manifest, fresh synthetic screenshots, browser/restore reports and verification logs.');
console.log('Deployment is deferred; the official guideline and human submission/demo acceptance remain outstanding.');
