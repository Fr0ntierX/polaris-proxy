import { PolarisProxyHandler } from "./polarisProxyHandler";

import { getConfig } from "../config";
import { PolarisSDK } from "../lib/polaris-sdk";
import { EphemeralKeyHandler } from "../lib/polaris-sdk/key/handlers/ephemeral";
import { getLogger } from "../logging";

import type { Express, NextFunction, Request, Response } from "express";

/**
 * Registers an encryption proxy for all endpoints using PolarisProxyHandler.
 *
 * @param {Express} app - The Express application instance.
 *
 */
export const registerEncryptionProxy = (app: Express): void => {
  // Get the configuration
  const config = getConfig();

  // Initialize PolarisSDK and PolarisProxyHandler
  const sdk = new PolarisSDK(new EphemeralKeyHandler());
  const polarisProxyHandler = new PolarisProxyHandler(sdk, config);

  // Register the proxy for all endpoints as a single middleware chain
  app.use(
    "*",
    polarisProxyHandler.polarisUnwrap.bind(polarisProxyHandler),
    polarisProxyHandler.polarisProxy.bind(polarisProxyHandler),
    (err: any, _req: Request, res: Response, next: NextFunction) => {
      if (err) {
        getLogger().error(err);
        res.status(400).send("Error processing request");
      } else {
        getLogger().info("proxying next");
        next();
      }
    }
  );
};
