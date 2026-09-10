import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function comparisonRange() {
  const configuredBase = process.env.LINT_BASE_REF;
  const pullRequestBase = process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : null;
  const baseRef = configuredBase || pullRequestBase;

  if (baseRef) {
    const mergeBase = git(["merge-base", baseRef, "HEAD"]);
    return [mergeBase, "HEAD"];
  }

  try {
    return [git(["rev-parse", "HEAD^"]), "HEAD"];
  } catch {
    return null;
  }
}

const range = comparisonRange();
if (!range) {
  console.log("No previous revision is available; changed-file lint has nothing to compare.");
  process.exit(0);
}

const changed = git(["diff", "--name-only", "--diff-filter=ACMR", range[0], range[1]])
  .split("\n")
  .map(file => file.trim())
  .filter(Boolean)
  .filter(file => /\.(?:c|m)?(?:j|t)sx?$/.test(file))
  .filter(file => existsSync(file));

if (!changed.length) {
  console.log("No changed JavaScript/TypeScript files to lint.");
  process.exit(0);
}

console.log(`Linting ${changed.length} changed JavaScript/TypeScript file${changed.length === 1 ? "" : "s"}.`);
const executable = resolve("node_modules", ".bin", process.platform === "win32" ? "eslint.cmd" : "eslint");
const result = spawnSync(executable, changed, { stdio: "inherit" });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
