import { PolarisProxyHandler } from "./handlers/polarisProxyHandler";

import { getConfig } from "../config";
import { getLogger } from "../logging";
import { createPolarisSDK } from "../sdk";

import type { Express, NextFunction, Request, Response } from "express";

/**
 * Registers an encryption proxy for all endpoints using PolarisProxyHandler.
 *
 * @param {Express} app - The Express application instance.
 *
 */
export const registerEncryptionProxy = async (app: Express): Promise<void> => {
  try {
    // Get the configuration
    const config = getConfig();

    // Initialize the PolarisProxyHandler
    const polarisSDK = await createPolarisSDK();
    const polarisProxyHandler = new PolarisProxyHandler(polarisSDK, config);

    // Register the proxy for all endpoints as a single middleware chain
    app.use(
      "*",
      polarisProxyHandler.polarisUnwrap.bind(polarisProxyHandler),
      polarisProxyHandler.polarisProxy.bind(polarisProxyHandler),
      (err: any, _req: Request, res: Response, next: NextFunction) => {
        if (err) {
          getLogger().error(err);
          res.status(400).send(`Error processing request: ${err.message}`);
        } else {
          next();
        }
      }
    );
  } catch (err: any) {
    console.log(err);
  }
};
