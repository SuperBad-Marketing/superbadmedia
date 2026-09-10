import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { relative, resolve } from "node:path";

const root = process.cwd();
const baselinePath = resolve(root, "quality", "test-failure-baseline.json");
const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));

if (!Array.isArray(baseline.allowedFailures)) {
  throw new Error("quality/test-failure-baseline.json must contain allowedFailures[].");
}

function normaliseText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normaliseFile(value) {
  return relative(root, resolve(root, String(value))).replaceAll("\\", "/");
}

function assertionIdentity(file, assertion) {
  const ancestors = Array.isArray(assertion.ancestorTitles)
    ? assertion.ancestorTitles.map(normaliseText).filter(Boolean)
    : [];
  const title = normaliseText(assertion.title);
  return `${file}::${[...ancestors, title].filter(Boolean).join(" > ")}`;
}

function printFailures(title, identities, messages) {
  if (!identities.length) return;
  console.error(`\n${title}`);
  for (const identity of identities) {
    console.error(`- ${identity}`);
    const failureMessages = messages.get(identity) ?? [];
    for (const message of failureMessages) {
      console.error(`  ${normaliseText(message).slice(0, 800)}`);
    }
  }
}

const tempDir = mkdtempSync(resolve(tmpdir(), "superbad-vitest-"));
const reportPath = resolve(tempDir, "report.json");
const executable = resolve(
  root,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "vitest.cmd" : "vitest",
);

try {
  const run = spawnSync(
    executable,
    ["run", "--reporter=json", `--outputFile=${reportPath}`],
    { env: process.env, stdio: "inherit" },
  );

  if (run.error) throw run.error;

  let report;
  try {
    report = JSON.parse(readFileSync(reportPath, "utf8"));
  } catch (error) {
    console.error("Vitest did not produce a readable JSON report.");
    throw error;
  }

  if (!Array.isArray(report.testResults)) {
    throw new Error("Vitest JSON report did not contain testResults[].");
  }

  const observed = new Set();
  const failureMessages = new Map();

  for (const testResult of report.testResults) {
    const file = normaliseFile(testResult.name);
    const assertions = Array.isArray(testResult.assertionResults)
      ? testResult.assertionResults
      : [];
    const failedAssertions = assertions.filter(
      (assertion) => assertion.status === "failed",
    );

    for (const assertion of failedAssertions) {
      const identity = assertionIdentity(file, assertion);
      observed.add(identity);
      failureMessages.set(
        identity,
        Array.isArray(assertion.failureMessages) ? assertion.failureMessages : [],
      );
    }

    if (testResult.status === "failed" && failedAssertions.length === 0) {
      const identity = `${file}::<module failure>`;
      observed.add(identity);
      failureMessages.set(identity, testResult.message ? [testResult.message] : []);
    }
  }

  const runtimeErrorSuites = Number(report.numRuntimeErrorTestSuites ?? 0);
  const allowed = new Set(baseline.allowedFailures.map(normaliseText));
  const observedFailures = [...observed].sort();
  const newFailures = observedFailures.filter((identity) => !allowed.has(identity));
  const resolvedFailures = [...allowed]
    .filter((identity) => !observed.has(identity))
    .sort();

  printFailures("New or changed test failures — quality gate FAILED:", newFailures, failureMessages);

  if (runtimeErrorSuites > 0) {
    console.error(`\nVitest reported ${runtimeErrorSuites} runtime-error test suite(s); these are never baselined.`);
  }

  if (newFailures.length > 0 || runtimeErrorSuites > 0) {
    process.exit(1);
  }

  if (run.signal) {
    console.error(`Vitest terminated by signal ${run.signal}.`);
    process.exit(1);
  }

  if ((run.status ?? 1) !== 0 && observedFailures.length === 0) {
    console.error("Vitest failed without a recognised assertion or module failure; refusing to treat it as baseline debt.");
    process.exit(1);
  }

  if ((run.status ?? 1) === 0 && observedFailures.length > 0) {
    console.error("Vitest exited successfully while the JSON report still contained failures; refusing an inconsistent result.");
    process.exit(1);
  }

  if (observedFailures.length > 0) {
    console.log(`Known pre-existing root test debt remains: ${observedFailures.length} failure identities.`);
    for (const identity of observedFailures) console.log(`- ${identity}`);
  } else {
    console.log("Root Vitest suite is fully green.");
  }

  if (resolvedFailures.length > 0) {
    console.log(`\nObserved improvement: ${resolvedFailures.length} baselined failure identities did not recur.`);
    for (const identity of resolvedFailures) console.log(`- ${identity}`);
    console.log("Shrink the baseline after the repair is verified; never auto-expand it.");
  }
} finally {
  rmSync(tempDir, { force: true, recursive: true });
}
