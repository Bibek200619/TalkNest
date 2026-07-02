import "dotenv/config";
import { createRuntime } from "./runtime.js";

const runtime = createRuntime();

runtime.httpServer.listen(runtime.config.port, () => {
  console.log(`TalkNest server listening on http://localhost:${runtime.config.port}`);
});

const shutdown = async (signal: NodeJS.Signals) => {
  console.log(`Received ${signal}; shutting down TalkNest server`);
  await runtime.close();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
