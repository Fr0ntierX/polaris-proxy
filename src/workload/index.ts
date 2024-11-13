import express from "express";

import { getConfig } from "../config";
import { getLogger } from "../logging";
import { polarisSDK } from "../sdk";

import type { Config } from "../config/types";
import type { Request } from "express";

const config: Config = getConfig();
const workloadApp = express();

const rawBody = async (req: Request): Promise<Buffer | undefined> => {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(chunks.length ? Buffer.concat(chunks) : undefined));
    req.on("error", (err: Error) => reject(err));
  });
};

workloadApp
  .use("/*", async (req, res) => {
    getLogger().info("processing workload request...");
    const body = await rawBody(req);
    if (!body) {
      res.status(200).send();
    } else {
      res.send(config.enableOutputEncryption ? await polarisSDK.encrypt(body, await polarisSDK.getPublicKey()) : body);
    }
    getLogger().info("workload request processed!");
  })
  .listen(3001);
