import { createHash } from "node:crypto";
function require(condition, message) { if (!condition) throw new Error(message); }
function uniqueStrings(values, label) {
  require(Array.isArray(values) && values.every(value => typeof value === "string" && value.length > 0), `Invalid ${label}.`);
  require(new Set(values).size === values.length, `Duplicate ${label}.`);
  return [...values].sort();
}
export function signature(errors, root) {
  require(Array.isArray(errors) && errors.length > 0, "Failed result has no diagnostic.");
  const messages = errors.map(error => {
    require(typeof error.name === "string" && typeof error.message === "string" && error.message.length > 0, "Invalid error diagnostic.");
    const message = error.message.replaceAll(root, "<ROOT>").replace(/\r\n/g, "\n").replace(/\u001b\[[0-9;]*m/g, "");
    return [error.name, message];
  });
  return createHash("sha256").update(JSON.stringify(messages)).digest("hex");
}
export function inspectReport(report, run, expectedFiles, context) {
  require(!run.error && !run.signal && [0, 1].includes(run.status), "Runner failed abnormally (spawn, signal or exit code).");
  require(report?.version === 1 && report.nonce === context.nonce && report.revision === context.revision, "Missing, stale or wrong-revision report.");
  require(["passed", "failed"].includes(report.reason), "Run did not finish normally.");
  require(Array.isArray(report.unhandledErrors) && report.unhandledErrors.length === 0, "Unhandled runner errors are never baseline debt.");
  const selected = uniqueStrings(report.selected, "selected files");
  require(selected.length > 0 && JSON.stringify(selected) === JSON.stringify([...expectedFiles].sort()), "Selected files do not match the independently enumerated root test inventory.");
  require(Array.isArray(report.files), "Missing file results.");
  require(JSON.stringify(uniqueStrings(report.files.map(file => file.file), "reported files")) === JSON.stringify(selected), "Partial or unexpected file results.");
  const failures = {}, skips = [], passed = new Set(), all = new Set();
  let executed = 0;
  function add(identity, errors) {
    require(!Object.hasOwn(failures, identity), `Ambiguous failure identity: ${identity}`);
    failures[identity] = signature(errors, context.root);
  }
  for (const file of report.files) {
    require(["passed", "failed", "skipped"].includes(file.state) && Array.isArray(file.errors) && Array.isArray(file.tests), "Invalid or unfinished file result.");
    if (file.errors.length) add(`${file.file}::<module failure>`, file.errors);
    const countBefore = Object.keys(failures).length;
    for (const test of file.tests) {
      require(typeof test.name === "string" && test.name.trim() && Array.isArray(test.errors), "Invalid assertion result.");
      const identity = `${file.file}::${test.name.replace(/\s+/g, " ").trim()}`;
      require(!all.has(identity), `Duplicate test identity: ${identity}`); all.add(identity);
      require(["passed", "failed", "skipped"].includes(test.state), "Unfinished test cannot count as a pass.");
      require(typeof test.flaky === "boolean", "Missing retry status.");
      require(!test.flaky, "Flaky/retried success requires investigation, not silent green.");
      if (test.state === "failed") { add(identity, test.errors); executed++; }
      else if (test.state === "passed") { require(test.errors.length === 0, "Passed test retained errors."); passed.add(identity); executed++; }
      else { require(test.errors.length === 0, "Skipped test retained errors."); skips.push(identity); }
    }
    require(file.state !== "skipped" || file.tests.every(test => test.state === "skipped"), "Skipped module contains executed assertions.");
    const fileFailed = file.errors.length > 0 || Object.keys(failures).length > countBefore;
    require((file.state === "failed") === fileFailed, "File state disagrees with diagnostics.");
    if (!fileFailed && file.tests.some(test => test.state === "passed")) passed.add(`${file.file}::<module failure>`);
    if (!file.tests.length && !fileFailed) throw new Error("Empty successful test module.");
  }
  require(executed > 0, "Zero executed assertions is not a test pass.");
  const hasFailures = Object.keys(failures).length > 0;
  require(run.status === (hasFailures ? 1 : 0) && report.reason === (hasFailures ? "failed" : "passed"), "Exit/reason/results disagree.");
  return { failures, skips: skips.sort(), passed, executed, files: selected.length };
}
export function validateBaseline(baseline, trusted) {
  require(baseline?.version === 2 && baseline.failures && typeof baseline.failures === "object" && !Array.isArray(baseline.failures), "Failure baseline v2 requires reviewed diagnostic fingerprints.");
  uniqueStrings(baseline.skips, "baseline skips");
  for (const [id, hash] of Object.entries(baseline.failures)) require(id.includes("::") && /^[a-f0-9]{64}$/.test(hash), "Invalid failure fingerprint.");
  require(trusted?.version === 2, "Trusted baseline v2 is required; initial migration must be explicitly pinned.");
  for (const [id, hash] of Object.entries(baseline.failures)) require(trusted.failures[id] === hash, `Baseline expanded or fingerprint changed: ${id}`);
  require(baseline.skips.every(id => trusted.skips.includes(id)), "Skipped-test baseline expanded.");
}
export function evaluateDebt(observed, baseline, trusted = baseline) {
  for (const id of Object.keys(trusted.failures)) if (!Object.hasOwn(baseline.failures, id)) require(observed.passed.has(id), `Retired failure lacks a passing repair: ${id}`);
  for (const id of trusted.skips) if (!baseline.skips.includes(id)) require(observed.passed.has(id), `Retired skip lacks a passing test: ${id}`);
  for (const [id, hash] of Object.entries(observed.failures)) require(baseline.failures[id] === hash, `New or changed failure diagnostic: ${id} (${hash})`);
  for (const id of observed.skips) require(baseline.skips.includes(id), `New skipped test: ${id}`);
  for (const id of Object.keys(baseline.failures)) if (!Object.hasOwn(observed.failures, id)) {
    require(observed.passed.has(id), `Baselined failure vanished or was skipped: ${id}`);
    throw new Error(`Repair passed; remove its obsolete failure allowance before accepting: ${id}`);
  }
  for (const id of baseline.skips) require(observed.skips.includes(id), `Remove the obsolete skip allowance after verifying: ${id}`);
  return { remainingFailures: Object.keys(observed.failures).length, existingSkips: observed.skips.length };
}

// Reviewed capture: CI 29/job 103070742405, unchanged app/tests/dependencies.
// Pin the observed data, not arbitrary candidate failures. This is not tamper-proof
// against an actor who can also edit this checker; independent review remains needed.
export function validateCalibration(base, baseline, trusted) {
  require(base === "3185217aea0d9120de37f21657d9279c8a3d4a8f" && baseline.capturedFrom === base, "Unrecognised calibration source.");
  require(trusted?.version === 1, "Calibration requires the original v1 target.");
  validateBaseline(baseline, baseline);
  const ids = uniqueStrings(trusted.allowedFailures, "original failure identities");
  require(JSON.stringify(Object.keys(baseline.failures).sort()) === JSON.stringify(ids), "Calibration cannot add or remove existing failure identities.");
  const payload = { failures: Object.entries(baseline.failures).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0), skips: [...baseline.skips].sort() };
  const digest = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  require(digest === "5cede9ba5f7fe9eb789b5f853d96f4f099f43d389ad1d875a440098a6ed73fb4", "Calibration differs from separately observed evidence.");
}
