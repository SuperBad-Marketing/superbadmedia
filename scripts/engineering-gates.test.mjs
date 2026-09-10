import assert from "node:assert/strict";
import { test } from "node:test";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
test("actual root gate propagates every stage failure and stops dependent stages", () => {
  const chain = manifest.scripts.check;
  const stages = chain.split(/\s*&&\s*/).map(stage => {
    const match = /^npm run ([\w:-]+)$/.exec(stage);
    assert.ok(match, `Unreviewed gate chaining: ${stage}`);
    assert.ok(manifest.scripts[match[1]], `Missing command: ${match[1]}`);
    return match[1];
  });
  for (const required of ["test:engineering", "lint:changed", "typecheck", "test:ratchet", "build"]) assert.ok(stages.includes(required), `Missing ${required}`);
  for (const failed of [...stages, "none"]) {
    const dir = mkdtempSync(join(tmpdir(), "sb-gate-plumbing-"));
    try {
      // Only npm is simulated, inside this fixture; this is not application evidence.
      const npm = join(dir, "npm");
      writeFileSync(npm, "#!/bin/sh\nprintf '%s\\n' \"$2\" >> \"$LOG\"\n[ \"$2\" != \"$FAIL\" ]\n");
      execFileSync("chmod", ["+x", npm]);
      const run = spawnSync("sh", ["-c", chain], { cwd: dir, encoding: "utf8", timeout: 10000, env: { ...process.env, PATH: `${dir}:${process.env.PATH}`, LOG: join(dir, "log"), FAIL: failed } });
      assert.equal(run.error, undefined); assert.equal(run.signal, null);
      assert.equal(run.status, failed === "none" ? 0 : 1, run.stderr);
      assert.deepEqual(readFileSync(join(dir, "log"), "utf8").trim().split("\n"), failed === "none" ? stages : stages.slice(0, stages.indexOf(failed) + 1));
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }
});
