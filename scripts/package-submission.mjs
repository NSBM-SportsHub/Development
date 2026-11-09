import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, isAbsolute, relative, resolve } from 'node:path';
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
const copies = [];
function plan(source, target) {
  assert.ok(existsSync(source), 'Missing package input: ' + source);
  copies.push({ source, target });
}
for (const name of evidenceNames) {
  plan(resolve('.artifacts', name), 'evidence/' + name);
}
for (const path of reports[0].screenshots) {
  assert.match(path, /^\.artifacts\/(?:release-[a-z-]+|complete-(?:reports|competition|training-mobile))\.png$/);
  plan(path, 'evidence/' + basename(path));
}
const logNames = ['release-build.log', 'release-frontend.log', 'release-configuration.log', 'release-integration.log', 'release-browser.log', 'release-backup.log', 'release-layout.log'];
for (const name of logNames) {
  assert.ok(existsSync(resolve('.artifacts', name)), 'Missing release check log: ' + name);
  plan(resolve('.artifacts', name), 'evidence/' + name);
}
const report = JSON.parse(readFileSync('.artifacts/project-report-evidence.json', 'utf8'));
assert.equal(report.source_sha256, context.source_sha256, 'Rebuild the report for the packaged source.');
assert.equal(report.template_sha256, createHash('sha256').update(readFileSync('docs/project-report.md')).digest('hex'), 'The report template changed; rebuild the PDF.');
assert.equal(report.leader_name, 'Mukilan Vasantharaj');
const reportSource = resolve('.artifacts', report.report_file);
assert.equal(createHash('sha256').update(readFileSync(reportSource)).digest('hex'), report.sha256, 'Report contents changed after verification.');
plan(reportSource, 'project-report/' + basename(report.report_file));
for (const name of ['project-report-filled.md', 'project-report-evidence.json']) {
  plan(resolve('.artifacts', name), 'project-report/' + name);
}
const supporting = JSON.parse(readFileSync('.artifacts/report-supporting-files.json', 'utf8'));
for (const item of supporting) {
  assert.match(item.package_path, /^supporting-documents\/[A-Za-z0-9-]+\//);
  assert.ok(!item.package_path.includes('\\') && !item.package_path.split('/').some((part) => part === '..' || part === '.'), 'Invalid supporting-document target.');
  const source = resolve(item.input_path);
  const local = relative(resolve('.artifacts/report-inputs'), source);
  assert.ok(local && !local.startsWith('..') && !isAbsolute(local), 'Supporting inputs must be staged under .artifacts/report-inputs.');
  assert.equal(createHash('sha256').update(readFileSync(source)).digest('hex'), item.sha256, item.original_name);
  plan(source, item.package_path);
}
// Validate inputs before creating an immutable release directory.
mkdirSync(output, { recursive: true });
git('archive', '--format=zip', '--prefix=SportsHub/', '--output=' + resolve(output, 'SportsHub-source.zip'), 'HEAD');
for (const { source, target } of copies) {
  const destination = resolve(output, target);
  mkdirSync(resolve(destination, '..'), { recursive: true });
  copyFileSync(source, destination);
}
const files = ['SportsHub-source.zip', ...copies.map((item) => item.target)];
writeFileSync(resolve(output, 'START-HERE.md'), '# NSBM SportsHub - combined submission draft\n\nTeam leader: Mukilan Vasantharaj.\n\n- project-report/: PDF draft, editable report and provenance.\n- SportsHub-source.zip: committed application and documentation.\n- supporting-documents/: original research, database architecture, guideline and supplied UI/UX files.\n- evidence/: synthetic screenshots and verification reports/logs.\n- manifest.json and SHA256SUMS.txt: source identity, open items and checksums.\n\nRead docs/design-evolution.md and docs/database-erd.md in the source archive alongside the earlier database image. Confirm actual research/design/code credits with the team.\n\nOpen items:\n\n' + report.pending_items.map((item) => '- ' + item).join('\n') + '\n\nDeployment is deferred. This draft has not been submitted through the LMS.\n');
files.push('START-HERE.md');
writeFileSync(resolve(output, 'manifest.json'), JSON.stringify({ ...context, packaged_at: new Date().toISOString(), source_archive: 'SportsHub-source.zip', source_files: tracked.length, evidence: files.filter((path) => path.startsWith('evidence/')), project_report: 'project-report/' + basename(report.report_file), report_status: report.status, supporting_documents: supporting.map(({ input_path, ...item }) => item), deployment: 'deferred by user', rubric_acceptance: 'official guideline reviewed; required deliverables remain incomplete', pending_items: report.pending_items, submission: 'not submitted', local_credentials_included: false }, null, 2) + '\n');
files.push('manifest.json');
writeFileSync(resolve(output, 'SHA256SUMS.txt'), files.map((path) => createHash('sha256').update(readFileSync(resolve(output, path))).digest('hex') + '  ' + path).join('\n') + '\n');
console.log('Created submission package: ' + output);
console.log('Includes source, draft PDF report, original supporting documents, manifest, fresh screenshots and verification evidence.');
console.log('Official guideline reviewed. Contact/design credits, video/live links and final team review/submission remain open.');
