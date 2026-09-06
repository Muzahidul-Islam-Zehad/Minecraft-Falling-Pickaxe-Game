import express from "express";
import { assertValidServerConfig, DEFAULT_SERVER_CONFIG } from "@mef/config";
import type { ServerStatus } from "@mef/shared-types";

/**
 * Phase 1 server shell (master spec §6): must start cleanly and expose /health.
 * Phases 9-14 add Socket.IO, event pipeline, YouTube, and admin wiring.
 */

const serverConfig = assertValidServerConfig(DEFAULT_SERVER_CONFIG);

const app = express();
const startedAt = Date.now();

app.get("/health", (_req, res) => {
  const status: ServerStatus = {
    youtubeState: "OFFLINE",
    connectedClients: { game: 0, admin: 0 },
    queueSize: 0,
    commandsPerMinute: 0,
    droppedEvents: 0,
    expiredEvents: 0,
    executedEvents: 0,
    uptimeMs: Date.now() - startedAt,
  };
  res.json({ ok: true, status });
});

app.listen(serverConfig.port, () => {
   
  console.info(
    `[server] Phase 1 shell listening on http://0.0.0.0:${serverConfig.port} (config validated)`,
  );
});
