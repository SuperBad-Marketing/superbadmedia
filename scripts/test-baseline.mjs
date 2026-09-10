import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { git, qualityBase, rootTestFiles } from "./quality-git.mjs";
import { evaluateDebt, inspectReport, validateBaseline, validateCalibration } from "./quality-report.mjs";

const baselineFile = "quality/test-failure-baseline.json";
const readJson = path => JSON.parse(readFileSync(path, "utf8"));
let temp;
try {
  if (process.argv.length !== 2) throw new Error("This gate always runs the full root suite; extra filters are not permitted.");
  const root = process.cwd();
  const base = qualityBase(root);
  const baseline = readJson(baselineFile);
  const trusted = JSON.parse(git(["show", `${base}:${baselineFile}`]));
  if (trusted.version === 1) validateCalibration(base, baseline, trusted);
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
  const disposition = evaluateDebt(observed, baseline, trusted.version === 2 ? trusted : baseline);
  console.log(JSON.stringify({ gate: "root-test-ratchet", ...disposition, files: observed.files, executed: observed.executed, revision: context.revision, base }));
  console.log("The root gate contains known test debt; it does not certify application or video-editor readiness.");
} catch (error) {
  console.error("Root test quality gate FAILED:", error.message);
  process.exitCode = 1;
} finally {
  if (temp) rmSync(temp, { recursive: true, force: true });
}
