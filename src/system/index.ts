import { healthHandler } from "./handlers/health";
import { publicKeyHandler } from "./handlers/publicKey";

import type { Express } from "express";

/**
 * Registers system endpoints.
 *
 * @param app - The Express application instance to register the endpoints on.
 */
export const registerSystemEndpoints = (app: Express) => {
  try {
    // Register the health check endpoint
    app.get("/polaris-container/health", healthHandler);
    app.get("/polaris-container/publicKey", publicKeyHandler);
  } catch (err: any) {
    console.log(err);
  }
};
