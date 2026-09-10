import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { changedPaths, qualityBase } from "./quality-git.mjs";

try {
  const base = qualityBase();
  const paths = changedPaths(base);
  const excluded = paths.filter(file => file.startsWith("video-editor/"));
  if (excluded.length) console.log("video-editor/ changes require its separate workspace checks; root lint is not editor evidence.");
  const files = paths.filter(file => /\.(?:c|m)?(?:j|t)sx?$/.test(file) && !file.startsWith("video-editor/"));
  console.log(`Changed-file lint base: ${base}; selected root JS/TS files: ${files.length}.`);
  if (files.length) {
    const cli = resolve("node_modules/eslint/bin/eslint.js");
    // JSON results ensure an ignored file cannot silently count as checked.
    const run = spawnSync(process.execPath, [cli, "--format=json", "--", ...files], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
    if (run.error || run.signal || ![0, 1].includes(run.status)) throw new Error(run.error?.message || run.stderr || "ESLint did not complete normally.");
    const report = JSON.parse(run.stdout);
    if (!Array.isArray(report)) throw new Error("ESLint did not return a result array.");
    const expected = new Set(files.map(file => resolve(file)));
    let hasErrors = false;
    for (const result of report) {
      if (!Number.isInteger(result.errorCount) || result.errorCount < 0 || !Array.isArray(result.messages)) throw new Error("Invalid ESLint result.");
      hasErrors ||= result.errorCount > 0;
      if (!expected.delete(resolve(result.filePath))) throw new Error("ESLint reported an unexpected or duplicate file.");
      for (const message of result.messages ?? []) {
        console.log(`${result.filePath}:${message.line ?? 0} ${message.message}`);
        if (/file ignored|no matching configuration/i.test(message.message)) throw new Error("Selected file was ignored by ESLint.");
      }
    }
    if (expected.size) throw new Error("ESLint omitted selected files.");
    if (run.status !== (hasErrors ? 1 : 0)) throw new Error("ESLint exit/result mismatch.");
    process.exitCode = run.status;
  } else {
    console.log("No applicable changed root JS/TS files. This is an explicit empty selection, not a full lint pass.");
  }
} catch (error) {
  console.error("Changed-file lint FAILED:", error.message);
  process.exitCode = 1;
}
