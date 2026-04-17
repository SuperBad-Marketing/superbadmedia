/* eslint-disable @typescript-eslint/no-require-imports -- CJS shim, require() is intentional */
// Dev-only shim: satisfies the `server-only` import for tsx scripts
// (seed, debug). Next.js replaces server-only at bundle time; tsx has
// no bundler, so the package's unconditional `throw` blows up any
// script that imports `lib/db`. Preloading this file with `-r` fills
// the require cache with an empty module before any user code runs.
const Module = require("node:module");
const path = require("node:path");
const resolved = require.resolve("server-only");
require.cache[resolved] = new Module(resolved);
require.cache[resolved].filename = resolved;
require.cache[resolved].loaded = true;
require.cache[resolved].exports = {};
void path;
