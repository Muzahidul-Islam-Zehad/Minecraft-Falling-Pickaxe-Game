/**
 * Runtime smoke test (master spec §6): proves all three apps start independently.
 * - apps/server: boots built output and answers /health with valid JSON.
 * - apps/game + apps/admin: dev servers boot in child processes, serve the app shell,
 *   and their built dist contains the app shell.
 *
 * Run with: node scripts/smoke-apps.mjs   (run `pnpm build` first for the dist check)
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const failures = [];

function check(name, ok, detail) {
   
  console[ok ? "log" : "error"](`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures.push(name);
}

// --- 1. Server: boot built output, poll /health ---
const serverProc = spawn(process.execPath, [path.join(root, "apps/server/dist/index.js")], {
  stdio: ["ignore", "pipe", "pipe"],
});
let serverOut = "";
serverProc.stdout.on("data", (d) => (serverOut += d));
serverProc.stderr.on("data", (d) => (serverOut += d));

try {
  let health = null;
  for (let i = 0; 40 > i; i++) {
    await new Promise((r) => setTimeout(r, 250));
    try {
      health = await (await fetch("http://127.0.0.1:3000/health")).json();
      break;
    } catch {
      /* not up yet */
    }
  }
  check(
    "server /health responds with valid JSON",
    health?.ok === true && typeof health?.status?.uptimeMs === "number",
  );
  check("server config validated at startup", serverOut.includes("config validated"));
} finally {
  serverProc.kill();
}

// --- 2. Game + admin: boot dev servers in child processes, fetch shell, verify dist ---
async function probeDevServer(name, port, mustInclude) {
  const appRoot = path.join(root, `apps/${name}`);

  // Production dist check (requires prior pnpm build)
  const distIndex = path.join(appRoot, "dist", "index.html");
  const distOk =
    fs.existsSync(distIndex) && fs.readFileSync(distIndex, "utf8").includes(mustInclude);
  check(`${name} production dist exists with app shell`, distOk);

  // Dev server boot check (isolated child process)
  const child = spawn(
    process.execPath,
    [path.join(root, "scripts/dev-server-probe.mjs"), appRoot, String(port)],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  let out = "";
  child.stdout.on("data", (d) => (out += d));
  child.stderr.on("data", (d) => (out += d));

  try {
    let ready = false;
    for (let i = 0; 60 > i; i++) {
      if (out.includes("DEV_SERVER_READY")) {
        ready = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 250));
    }
    if (!ready) {
      check(`${name} dev server boots`, false, `child output: ${JSON.stringify(out.slice(0, 300))}`);
      return;
    }

    const res = await fetch(`http://127.0.0.1:${port}/`);
    const body = await res.text();
    check(
      `${name} dev server boots and serves app shell`,
      res.ok && body.includes(mustInclude),
      `HTTP ${res.status}`,
    );
  } catch (err) {
    check(`${name} dev server boots and serves app shell`, false, err?.message ?? String(err));
  } finally {
    child.kill();
  }
}

await probeDevServer("game", 5193, "Minecraft Endless Fall");
await probeDevServer("admin", 5194, "MEF Admin");

 
console.log(
  failures.length === 0
    ? "\nAll runtime smoke checks passed."
    : `\nFailures: ${failures.join(", ")}`,
);
process.exitCode = failures.length === 0 ? 0 : 1;
