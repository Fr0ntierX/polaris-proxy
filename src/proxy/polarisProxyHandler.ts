import proxy from "express-http-proxy";

import { getLogger } from "../logging";

import type { Config } from "../config/types";
import type { PolarisSDK } from "../lib/polaris-sdk";
import type { NextFunction, Request, Response } from "express";
import type { RequestOptions } from "http";

// Extended Request interface to include custom properties
export interface PolarisRequest extends Request {
  polarisPayload?: {
    path: string;
    headers: Record<string, string>;
    body?: Buffer;
  };
}

export class PolarisProxyHandler {
  private readonly polarisRoot: string;
  private readonly polarisHeader: string;
  private readonly config: Config;
  private readonly sdk: PolarisSDK;

  constructor(sdk: PolarisSDK, config: Config) {
    this.sdk = sdk;
    this.config = config;
    this.polarisRoot = this.config.polarisContextRoot;
    this.polarisHeader = this.config.polarisHeaderKey;
  }

  private async getRawBody(req: PolarisRequest): Promise<Buffer | undefined> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      req.on("data", (chunk: Buffer) => chunks.push(chunk));
      req.on("end", () => resolve(chunks.length ? Buffer.concat(chunks) : undefined));
      req.on("error", (err: Error) => reject(err));
    });
  }

  private async getInbound(input: Buffer | string): Promise<Buffer> {
    return this.config.enableInputEncryption
      ? this.sdk.decrypt(typeof input === "string" ? Buffer.from(input, "hex") : input)
      : Buffer.from(input);
  }

  private async getOutbound(input: Buffer): Promise<Buffer> {
    const out = this.config.enableOutputEncryption
      ? await this.sdk.encrypt(input, await this.sdk.getPublicKey())
      : input;
    return out;
  }

  async polarisUnwrap(req: PolarisRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const root = this.polarisRoot ? `/${this.polarisRoot}/` : "/";

      const path = req.baseUrl.split(root).pop() || "";
      getLogger().info(`polarisUnwrap - root: ${root} - path: ${path}`);

      const headers = (req.headers[this.polarisHeader] as string) || "{}";

      // treat polarisPayloads
      const polarisPath = (await this.getInbound(path)).toString();
      const polarisHeaders = JSON.parse((await this.getInbound(headers)).toString());
      req.polarisPayload = {
        path: polarisPath,
        headers: polarisHeaders,
      };
      const rawBody = await this.getRawBody(req);
      if (rawBody) {
        req.polarisPayload.body = await this.getInbound(rawBody);
      }
      getLogger().info(`polarisUnwrap: ${polarisPath}`);

      next();
    } catch (error) {
      getLogger().error(`polarisUnwrap error: ${error}`);
      next(error);
    }
  }

  polarisProxy(req: PolarisRequest, res: Response, next: NextFunction): void {
    getLogger().info(`polarisProxy: ${this.config.workloadBaseUrl}`);

    proxy(this.config.workloadBaseUrl, {
      parseReqBody: false,
      proxyReqPathResolver: (proxyReq: Request) => {
        const endpoint = "/" + req.polarisPayload?.path || proxyReq.url;
        getLogger().info(`polarisProxy endpoint: ${endpoint}`);
        return endpoint;
      },
      proxyReqOptDecorator: (proxyReqOpts: RequestOptions, srcReq: Request) => {
        if (req.polarisPayload?.headers) {
          proxyReqOpts.headers = req.polarisPayload.headers;
          getLogger().info(`polarisProxy headers added`);
        }
        return proxyReqOpts;
      },
      proxyReqBodyDecorator: (bodyContent: unknown, srcReq: Request) => {
        const body = req.polarisPayload?.body || bodyContent;
        getLogger().info(`polarisProxy body applied`);
        return body;
      },
      userResDecorator: async (proxyRes, proxyResData, userReq, userRes) => {
        const body = await this.getOutbound(proxyResData);
        getLogger().info(`polarisProxy response applied`);
        return body;
      },
    })(req, res, next);
  }
}
