import { createServer } from "node:http";
import { loadConfig, type AppConfig } from "./config.js";
import { TalkNestDatabase } from "./database.js";
import { createApp } from "./http.js";
import { createSocketServer } from "./socket.js";

export function createRuntime(config: AppConfig = loadConfig()) {
  const db = new TalkNestDatabase(config.databasePath);
  const { app, authService } = createApp({ db, config });
  const httpServer = createServer(app);
  const io = createSocketServer({
    httpServer,
    db,
    authService,
    config
  });

  return {
    app,
    httpServer,
    io,
    db,
    config,
    close: async () => {
      await new Promise<void>((resolve) => io.close(() => resolve()));
      await new Promise<void>((resolve, reject) => {
        httpServer.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      }).catch((error) => {
        if ((error as NodeJS.ErrnoException).code !== "ERR_SERVER_NOT_RUNNING") {
          throw error;
        }
      });
      db.close();
    }
  };
}
