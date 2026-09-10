import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function tryGit(args) {
  try {
    return git(args);
  } catch {
    return "";
  }
}

function baseline() {
  const configured = process.env.LINT_BASE_REF;
  if (configured && !/^0+$/.test(configured)) {
    const base = tryGit(["merge-base", configured, "HEAD"]);
    if (base) return base;
  }

  if (tryGit(["rev-parse", "--verify", "origin/main"])) {
    const base = tryGit(["merge-base", "origin/main", "HEAD"]);
    if (base) return base;
  }

  return git(["rev-parse", "HEAD"]);
}

function addLines(target, output) {
  for (const file of output.split("\n").map(value => value.trim()).filter(Boolean)) target.add(file);
}

const base = baseline();
const changedPaths = new Set();
addLines(changedPaths, git(["diff", "--name-only", "--diff-filter=ACMR", base, "HEAD"]));
addLines(changedPaths, git(["diff", "--name-only", "--diff-filter=ACMR"]));
addLines(changedPaths, git(["diff", "--cached", "--name-only", "--diff-filter=ACMR"]));
addLines(changedPaths, git(["ls-files", "--others", "--exclude-standard"]));

const changed = [...changedPaths]
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
