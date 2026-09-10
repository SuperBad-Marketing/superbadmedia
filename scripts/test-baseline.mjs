import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { git, qualityBase, rootTestFiles } from "./quality-git.mjs";
import { evaluateDebt, inspectReport, validateBaseline } from "./quality-report.mjs";

const baselineFile = "quality/test-failure-baseline.json";
const originalCaptureSource = "3185217aea0d9120de37f21657d9279c8a3d4a8f";
function readJson(path) { return JSON.parse(readFileSync(path, "utf8")); }

function validateMigration(base, baseline, trusted) {
  if (base !== originalCaptureSource || (baseline.version === 2 && baseline.capturedFrom !== base)) throw new Error("Unrecognised baseline migration source.");
  const permitted = new Set([
    "AGENTS.md", "package.json", ".github/workflows/ci.yml", baselineFile,
    "scripts/quality-git.mjs", "scripts/quality-report.mjs", "scripts/quality-reporter.mjs",
    "scripts/lint-changed.mjs", "scripts/test-baseline.mjs", "scripts/engineering-gates.test.mjs",
  ]);
  const changed = git(["diff", "--name-only", "-z", base, "HEAD", "--"]).split("\0").filter(Boolean);
  if (changed.some(file => !permitted.has(file) && !file.startsWith("docs/engineering/"))) throw new Error("Baseline migration requires unchanged application/test source.");
  const oldPackage = JSON.parse(git(["show", `${base}:package.json`]));
  const newPackage = readJson("package.json");
  delete oldPackage.scripts; delete newPackage.scripts;
  if (JSON.stringify(oldPackage) !== JSON.stringify(newPackage)) throw new Error("Baseline migration cannot change dependencies or package settings.");
  const ids = baseline.version === 1 ? baseline.allowedFailures : Object.keys(baseline.failures);
  if (JSON.stringify([...ids].sort()) !== JSON.stringify([...trusted.allowedFailures].sort())) throw new Error("Baseline migration must retain the exact existing failure identities.");
}

let temp;
try {
  if (process.argv.length !== 2) throw new Error("This gate always runs the full root suite; extra filters are not permitted.");
  const root = process.cwd();
  const base = qualityBase(root);
  const baseline = readJson(baselineFile);
  const trusted = JSON.parse(git(["show", `${base}:${baselineFile}`]));
  if (trusted.version === 1) validateMigration(base, baseline, trusted);
  else validateBaseline(baseline, trusted);
  const expectedFiles = rootTestFiles(root);
  temp = mkdtempSync(resolve(tmpdir(), "superbad-quality-"));
  const reportPath = resolve(temp, "report.json");
  const context = { root, nonce: randomUUID(), revision: git(["rev-parse", "HEAD"]).trim() };
  const run = spawnSync(process.execPath, [
    resolve(root, "node_modules/vitest/vitest.mjs"), "run",
    "--reporter=default", `--reporter=${resolve(root, "scripts/quality-reporter.mjs")}`,
    "--allowOnly=false", "--passWithNoTests=false", "--dangerouslyIgnoreUnhandledErrors=false",
  ], { stdio: "inherit", timeout: 20 * 60 * 1000, env: {
    ...process.env, QUALITY_REPORT_PATH: reportPath, QUALITY_REPORT_NONCE: context.nonce,
    QUALITY_REPORT_REVISION: context.revision,
  } });
  const observed = inspectReport(readJson(reportPath), run, expectedFiles, context);
  if (baseline.version === 1) {
    const allowed = new Set(baseline.allowedFailures);
    const extraFailures = Object.keys(observed.failures).filter(id => !allowed.has(id));
    const missingFailures = [...allowed].filter(id => !Object.hasOwn(observed.failures, id));
    console.log("BASELINE_CALIBRATION_EVIDENCE=" + JSON.stringify({
      version: 2, capturedFrom: base,
      reason: "Existing root debt only, not a clean test result. Diagnostic fingerprints and existing skips observed on unchanged application/test source; no new failure is allowed by calibration.",
      failures: Object.fromEntries(Object.entries(observed.failures).filter(([id]) => allowed.has(id))),
      skips: observed.skips,
    }));
    console.log("CALIBRATION_DISCREPANCIES=" + JSON.stringify({ extraFailures, missingFailures, files: observed.files, executed: observed.executed, revision: context.revision }));
    throw new Error("v2 calibration must be reviewed and discrepancies investigated. This evidence-only run is NOT a quality PASS.");
  }
  const disposition = evaluateDebt(observed, baseline, trusted.version === 2 ? trusted : baseline);
  console.log(JSON.stringify({ gate: "root-test-ratchet", ...disposition, files: observed.files, executed: observed.executed, revision: context.revision, base }));
  console.log("The root gate contains known test debt; it does not certify application or video-editor readiness.");
} catch (error) {
  console.error("Root test quality gate FAILED:", error.message);
  process.exitCode = 1;
} finally {
  if (temp) rmSync(temp, { recursive: true, force: true });
}
