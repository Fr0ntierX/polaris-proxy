import { healthHandler } from "./handlers/health";
import { logLevelHandler } from "./handlers/logLevel";
import { publicKeyHandler } from "./handlers/publicKey";

import type { Express } from "express";

/**
 * Registers system endpoints.
 *
 * @param app - The Express application instance to register the endpoints on.
 */
export const registerSystemEndpoints = (app: Express) => {
  // Register the health check endpoint
  app.get("/polaris-container/health", healthHandler);
  app.get("/polaris-container/publicKey", publicKeyHandler);
  app.get("/polaris-container/logLevel", logLevelHandler);
};
