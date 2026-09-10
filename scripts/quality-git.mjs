import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { relative, resolve } from "node:path";

export function git(args, root = process.cwd()) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function commit(ref, root) {
  if (!ref || ref.startsWith("-") || /^0+$/.test(ref)) throw new Error("A real quality base commit is required.");
  return git(["rev-parse", "--verify", `${ref}^{commit}`], root).trim();
}

// CI supplies the event's base SHA, not origin/main (which equals HEAD after a merge).
export function qualityBase(root = process.cwd(), env = process.env) {
  const explicit = env.QUALITY_BASE_REF || env.LINT_BASE_REF;
  let base;
  if (explicit) {
    base = commit(explicit, root); // Invalid explicit input must never silently fall back.
  } else {
    if (env.CI) throw new Error("CI must set QUALITY_BASE_REF to the PR base or push.before SHA.");
    try {
      base = git(["merge-base", "origin/main", "HEAD"], root).trim();
    } catch {
      throw new Error("No comparison base. Fetch the target branch or set QUALITY_BASE_REF explicitly.");
    }
    if (base === commit("HEAD", root)) base = commit("HEAD^", root);
  }
  if (base === commit("HEAD", root)) throw new Error("Quality base equals HEAD; this would omit committed changes.");
  git(["merge-base", "--is-ancestor", base, "HEAD"], root);
  return base;
}

export function changedPaths(base, root = process.cwd()) {
  const paths = new Set();
  for (const args of [
    ["diff", "--name-only", "-z", "--diff-filter=ACMR", base, "HEAD", "--"],
    ["diff", "--name-only", "-z", "--diff-filter=ACMR", "--"],
    ["diff", "--cached", "--name-only", "-z", "--diff-filter=ACMR", "--"],
    ["ls-files", "--others", "--exclude-standard", "-z"],
  ]) {
    for (const file of git(args, root).split("\0").filter(Boolean)) paths.add(file);
  }
  return [...paths].filter(file => existsSync(resolve(root, file))).sort();
}

export function rootTestFiles(root = process.cwd()) {
  const files = [];
  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const file = resolve(dir, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Unexpected symlink in root tests: ${file}`);
      if (entry.isDirectory()) walk(file);
      else if (/\.test\.tsx?$/.test(entry.name)) files.push(relative(root, file).replaceAll("\\", "/"));
    }
  }
  walk(resolve(root, "tests"));
  if (!files.length) throw new Error("Root test inventory is empty.");
  return files.sort();
}
