import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, renameSync, symlinkSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { qualityBase, changedPaths, rootTestFiles, git } from "./quality-git.mjs";
import { inspectReport, signature, validateBaseline, evaluateDebt, validateCalibration } from "./quality-report.mjs";

const context = { nonce: "fixture-nonce", revision: "fixture-revision", root: "/fixture" };
const goodRun = { status: 0, signal: null };
const error = { name: "AssertionError", message: "expected 2 to be 1" };
const identity = "tests/sample.test.ts::a";
function report() {
  return { version: 1, nonce: context.nonce, revision: context.revision, reason: "passed", selected: ["tests/sample.test.ts"], unhandledErrors: [], files: [{ file: "tests/sample.test.ts", state: "passed", errors: [], tests: [{ name: "a", state: "passed", errors: [], flaky: false }] }] };
}
function inspect(value, run = goodRun) { return inspectReport(value, run, ["tests/sample.test.ts"], context); }
function failed() {
  const value = report(); value.reason = "failed"; value.files[0].state = "failed";
  Object.assign(value.files[0].tests[0], { state: "failed", errors: [error] }); return value;
}
function baseline() { return { version: 2, failures: { [identity]: signature([error], context.root) }, skips: [] }; }

test("valid and recognised failing reports are inspected without pretending debt is green", () => {
  assert.equal(inspect(report()).executed, 1);
  const observed = inspect(failed(), { status: 1, signal: null });
  assert.deepEqual(evaluateDebt(observed, baseline()), { remainingFailures: 1, existingSkips: 0 });
});
const invalidReports = [
  ["missing report", () => null, /Missing, stale/],
  ["empty selection", value => { value.selected = []; return value; }, /inventory/],
  ["wrong nonce", value => { value.nonce = "old"; return value; }, /stale/],
  ["wrong revision", value => { value.revision = "other"; return value; }, /revision/],
  ["interrupted", value => { value.reason = "interrupted"; return value; }, /normally/],
  ["unhandled error", value => { value.unhandledErrors = [error]; return value; }, /Unhandled/],
  ["missing error field", value => { delete value.unhandledErrors; return value; }, /Unhandled/],
  ["partial files", value => { value.files = []; return value; }, /Partial/],
  ["duplicate files", value => { value.files.push(value.files[0]); return value; }, /Duplicate/],
  ["wrong workspace", value => { value.selected = ["video-editor/example.test.ts"]; return value; }, /inventory/],
  ["empty module", value => { value.files[0].tests = []; return value; }, /Empty/],
  ["unfinished assertion", value => { value.files[0].tests[0].state = "pending"; return value; }, /Unfinished/],
  ["flaky pass", value => { value.files[0].tests[0].flaky = true; return value; }, /Flaky/],
  ["duplicate identity", value => { value.files[0].tests.push(value.files[0].tests[0]); return value; }, /Duplicate/],
  ["passing assertion with errors", value => { value.files[0].tests[0].errors = [error]; return value; }, /retained errors/],
  ["zero executed assertions", value => { value.files[0].tests[0].state = "skipped"; return value; }, /Zero executed/],
  ["state without diagnostic", value => { value.files[0].state = "failed"; return value; }, /disagrees/],
];
for (const [name, mutate, expected] of invalidReports) test(`FM-V01/02: rejects ${name}`, () => assert.throws(() => inspect(mutate(report())), expected));
for (const run of [{ status: 2 }, { status: 137 }, { status: null, signal: "SIGTERM" }, { status: null, error: new Error("spawn") }]) test(`FM-V05: rejects abnormal run ${JSON.stringify(run)}`, () => assert.throws(() => inspect(failed(), run), /abnormally/));
test("failed report plus exit zero and success plus exit one both reject", () => {
  assert.throws(() => inspect(failed()), /disagree/);
  assert.throws(() => inspect(report(), { status: 1 }), /disagree/);
});
test("FM-V03: new failure identity, cause and skip cannot be baselined by candidate", () => {
  const trusted = baseline(); const newIdentity = structuredClone(trusted); newIdentity.failures["tests/new.test.ts::b"] = "1".repeat(64);
  assert.throws(() => validateBaseline(newIdentity, trusted), /expanded/);
  const newHash = structuredClone(trusted); newHash.failures[identity] = "2".repeat(64);
  assert.throws(() => validateBaseline(newHash, trusted), /fingerprint changed/);
  const newSkip = structuredClone(trusted); newSkip.skips.push(identity);
  assert.throws(() => validateBaseline(newSkip, trusted), /expanded/);
  const changed = failed(); changed.files[0].tests[0].errors[0] = { ...error, message: "expected 200 to be 403" };
  assert.throws(() => evaluateDebt(inspect(changed, { status: 1 }), trusted), /changed failure/);
});
test("FM-V03: missing/skipped baseline failure is not a repair", () => {
  const value = { failures: {}, passed: new Set(), skips: [identity] };
  assert.throws(() => evaluateDebt(value, baseline()), /New skipped/);
  value.skips = []; assert.throws(() => evaluateDebt(value, baseline()), /vanished/);
});
test("verified repair shrinks baseline, unverified retirement rejects", () => {
  const trusted = baseline(), empty = { version: 2, failures: {}, skips: [] };
  validateBaseline(empty, trusted);
  assert.throws(() => evaluateDebt({ failures: {}, skips: [], passed: new Set() }, empty, trusted), /lacks a passing repair/);
  assert.deepEqual(evaluateDebt(inspect(report()), empty, trusted), { remainingFailures: 0, existingSkips: 0 });
  assert.throws(() => evaluateDebt(inspect(report()), trusted), /remove its obsolete/);
});
test("diagnostic normalisation ignores location/ANSI but preserves assertion values", () => {
  const hash = signature([{ name: "Error", message: "\u001b[31m/fixture/a\r\nvalue 1\u001b[0m" }], "/fixture");
  assert.equal(hash, signature([{ name: "Error", message: "/other/a\nvalue 1" }], "/other"));
  assert.notEqual(hash, signature([{ name: "Error", message: "/other/a\nvalue 2" }], "/other"));
});
function fixture(fn) {
  const dir = mkdtempSync(join(tmpdir(), "sb-quality-git-"));
  try { fn(dir); } finally { rmSync(dir, { recursive: true, force: true }); }
}
function write(dir, file, data = "test") { mkdirSync(join(dir, file, ".."), { recursive: true }); writeFileSync(join(dir, file), data); }
function commitAll(dir) { git(["add", "."], dir); git(["-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-m", "fixture"], dir); return git(["rev-parse", "HEAD"], dir).trim(); }
test("FM-V02: real Git PR/push selection preserves filenames and uncommitted work", () => fixture(dir => {
  git(["init", "-b", "main"], dir); write(dir, "existing.ts"); const before = commitAll(dir);
  write(dir, "new name ü.ts"); write(dir, "rename.ts"); const after = commitAll(dir);
  git(["update-ref", "refs/remotes/origin/main", after], dir);
  assert.equal(qualityBase(dir, { CI: "true", QUALITY_BASE_REF: before }), before);
  assert.equal(qualityBase(dir, {}), before);
  assert.deepEqual(changedPaths(before, dir), ["new name ü.ts", "rename.ts"]);
  write(dir, "existing.ts", "changed"); write(dir, "untracked.ts"); renameSync(join(dir, "rename.ts"), join(dir, "renamed.ts")); git(["add", "renamed.ts"], dir);
  assert.deepEqual(changedPaths(before, dir), ["existing.ts", "new name ü.ts", "renamed.ts", "untracked.ts"]);
  assert.throws(() => qualityBase(dir, { CI: "true", QUALITY_BASE_REF: after }), /equals HEAD/);
  assert.throws(() => qualityBase(dir, { CI: "true", QUALITY_BASE_REF: "missing-ref" }));
  assert.throws(() => qualityBase(dir, { CI: "true", QUALITY_BASE_REF: "0".repeat(40) }), /real quality base/);
  assert.throws(() => qualityBase(dir, { CI: "true" }), /must set/);
}));
test("FM-V01: root inventory rejects missing, empty and symlinked tests", () => fixture(dir => {
  assert.throws(() => rootTestFiles(dir), /ENOENT/); mkdirSync(join(dir, "tests"));
  assert.throws(() => rootTestFiles(dir), /empty/);
  write(dir, "tests/a.test.ts"); write(dir, "tests/nested/b.test.tsx");
  assert.deepEqual(rootTestFiles(dir), ["tests/a.test.ts", "tests/nested/b.test.tsx"]);
  symlinkSync(join(dir, "tests/a.test.ts"), join(dir, "tests/link.test.ts"));
  assert.throws(() => rootTestFiles(dir), /symlink/);
}));

const scripts = dirname(fileURLToPath(import.meta.url));
for (const [scenario, expectedStatus, reason] of [
  ["valid", 0, /selected root JS/], ["lint-error", 1, /sentinel lint error/],
  ["missing-files", 1, /omitted selected/], ["ignored", 1, /ignored by ESLint/],
  ["bad-exit", 1, /complete normally/], ["swallowed", 1, /exit.result mismatch/],
  ["malformed", 1, /FAILED/], ["duplicate", 1, /duplicate file/],
]) test(`actual changed-lint CLI: ${scenario}`, () => fixture(dir => {
  git(["init", "-b", "main"], dir); write(dir, "readme.md"); const before = commitAll(dir);
  write(dir, "changed with space.ts", "const n = 1;"); commitAll(dir);
  for (const file of ["lint-changed.mjs", "quality-git.mjs"]) write(dir, `scripts/${file}`, readFileSync(join(scripts, file), "utf8"));
  write(dir, "node_modules/eslint/bin/eslint.js", `
    const {resolve}=require('node:path');
    const scenario=${JSON.stringify(scenario)};
    if(scenario==='bad-exit')process.exit(2);
    if(scenario==='malformed'){console.log('{');process.exit(0);}
    const files=process.argv.slice(process.argv.indexOf('--')+1);
    let result=files.map(file=>({filePath:resolve(file),errorCount:0,messages:[]}));
    if(scenario==='missing-files')result=[];
    if(scenario==='duplicate')result.push(result[0]);
    if(scenario==='ignored')result[0].messages=[{message:'File ignored because of matching ignore pattern.'}];
    if(scenario==='lint-error'||scenario==='swallowed'){result[0].errorCount=1;result[0].messages=[{message:'sentinel lint error'}];}
    console.log(JSON.stringify(result));process.exit(scenario==='lint-error'?1:0);
  `);
  const run=spawnSync(process.execPath,[join(dir,"scripts/lint-changed.mjs")],{cwd:dir,encoding:"utf8",timeout:10000,env:{...process.env,CI:"true",QUALITY_BASE_REF:before}});
  assert.equal(run.error,undefined); assert.equal(run.signal,null);
  assert.equal(run.status,expectedStatus,run.stdout+run.stderr);
  assert.match(run.stdout+run.stderr,reason);
}));

test("v1 calibration is pinned to the separately observed data", () => {
  const baseline = JSON.parse(readFileSync(join(scripts, "../quality/test-failure-baseline.json"), "utf8"));
  const base = "3185217aea0d9120de37f21657d9279c8a3d4a8f";
  const trusted = { version: 1, allowedFailures: Object.keys(baseline.failures) };
  validateCalibration(base, baseline, trusted);
  assert.throws(() => validateCalibration("wrong-source", baseline, trusted), /source/);
  const altered = structuredClone(baseline); altered.failures[trusted.allowedFailures[0]] = "0".repeat(64);
  assert.throws(() => validateCalibration(base, altered, trusted), /separately observed/);
  altered.skips.push("tests/new.test.ts::new");
  assert.throws(() => validateCalibration(base, altered, trusted), /separately observed/);
  delete altered.failures[trusted.allowedFailures[0]];
  assert.throws(() => validateCalibration(base, altered, trusted), /cannot add or remove/);
});

test("installed Vitest reporter: valid, failing, empty and unhandled-error controls", t => {
  const root = dirname(scripts), cli = join(root, "node_modules/vitest/vitest.mjs");
  if (!existsSync(cli)) {
    assert.ok(!process.env.CI, "CI must install Vitest for lifecycle controls.");
    t.skip("Source snapshot lacks installed Vitest; not counted as executed lifecycle verification."); return;
  }
  for (const scenario of ["valid", "failing", "empty", "unhandled"]) fixture(dir => {
    write(dir, "vitest.config.mjs", `export default {root:${JSON.stringify(dir)},test:{include:['example.test.mjs'],allowOnly:false,passWithNoTests:false,dangerouslyIgnoreUnhandledErrors:false}};`);
    const api = pathToFileURL(join(root, "node_modules/vitest/dist/index.js")).href;
    if (scenario !== "empty") write(dir, "example.test.mjs", `import {test,expect} from ${JSON.stringify(api)};test('reporter sentinel',async()=>{${scenario === "unhandled" ? "Promise.reject(new Error('deliberate unhandled sentinel')); await new Promise(r=>setTimeout(r,50));" : ""}expect(1).toBe(${scenario === "failing" ? 2 : 1});});`);
    const reportPath=join(dir,"report.json"), ctx={root:dir,nonce:"isolated-nonce",revision:"isolated-revision"};
    const run=spawnSync(process.execPath,[cli,"run","--config",join(dir,"vitest.config.mjs"),`--reporter=${join(scripts,"quality-reporter.mjs")}`],{cwd:dir,encoding:"utf8",timeout:60000,env:{...process.env,CI:"true",QUALITY_REPORT_PATH:reportPath,QUALITY_REPORT_NONCE:ctx.nonce,QUALITY_REPORT_REVISION:ctx.revision}});
    assert.equal(run.error,undefined,run.stdout+run.stderr);assert.equal(run.signal,null);
    assert.equal(run.status,scenario === "valid" ? 0 : 1,run.stdout+run.stderr);
    const data=JSON.parse(readFileSync(reportPath,"utf8"));
    const inspectActual=()=>inspectReport(data,run,["example.test.mjs"],ctx);
    if(scenario === "valid") assert.equal(inspectActual().executed,1);
    else if(scenario === "failing") assert.throws(()=>evaluateDebt(inspectActual(),{version:2,failures:{},skips:[]}),/New or changed failure/);
    else assert.throws(inspectActual,scenario === "empty" ? /inventory/ : /Unhandled/);
  });
});
