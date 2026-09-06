/**
 * Dev-server probe child used by smoke-apps.mjs.
 * Boots a vite dev server for one app, prints DEV_SERVER_READY on stdout, then stays alive
 * until the parent kills it. Isolated per-process so esbuild/vite lifecycle issues cannot
 * destabilize the smoke-test parent.
 *
 * Usage: node scripts/dev-server-probe.mjs <appRoot> <port>
 */
import { createServer } from "vite";
import path from "node:path";

const appRoot = path.resolve(process.argv[2] ?? ".");
const port = Number(process.argv[3] ?? 5173);

const server = await createServer({
  root: appRoot,
  configFile: path.join(appRoot, "vite.config.ts"),
  server: { port, strictPort: true, host: "127.0.0.1" },
  logLevel: "error",
});

await server.listen();
 
console.log("DEV_SERVER_READY");

// Stay alive until the parent kills us.
setInterval(() => {}, 1 << 30);
