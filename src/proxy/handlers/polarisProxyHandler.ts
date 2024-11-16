import proxy from "express-http-proxy";

import { getLogger } from "../../logging";

import type { Config } from "../../config/types";
import type { PolarisRequest } from "../types";
import type { PolarisSDK } from "@fr0ntier-x/polaris-sdk";
import type { NextFunction, Request, Response } from "express";
import type { RequestOptions } from "http";
import type { Logger } from "pino";

export class PolarisProxyHandler {
  private readonly polarisSDK: PolarisSDK;
  private readonly config: Config;
  private readonly logger: Logger;

  constructor(polarisSDK: PolarisSDK, config: Config) {
    this.polarisSDK = polarisSDK;
    this.config = config;
    this.logger = getLogger();
  }

  private async getRawBody(req: PolarisRequest): Promise<Buffer | undefined> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      req.on("data", (chunk: Buffer) => chunks.push(chunk));
      req.on("end", () => resolve(chunks.length ? Buffer.concat(chunks) : undefined));
      req.on("error", (err: Error) => reject(err));
    });
  }

  private async decryptData(data: Buffer): Promise<Buffer> {
    return await this.polarisSDK.decrypt(data);
  }

  private async encryptResponse(responseData: Buffer, publicKey: string): Promise<Buffer> {
    return await this.polarisSDK.encrypt(responseData, publicKey);
  }

  async polarisUnwrap(req: PolarisRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      // Check if the response public key is provided if output encryption is enabled
      if (this.config.enableOutputEncryption && !req.headers[this.config.polarisResponsePublicKeyHeader]) {
        throw new Error("Response public key is required for output encryption");
      }
      const responsePublicKey = this.config.enableOutputEncryption
        ? Buffer.from(req.headers[this.config.polarisResponsePublicKeyHeader] as string, "base64url").toString()
        : undefined;

      // Process the request parameters
      if (this.config.enableInputEncryption) {
        // Process the URL
        const decryptedUrl = await this.decryptData(Buffer.from(req.baseUrl.slice(1), "base64url"));
        const workloadUrl = decryptedUrl.toString();
        this.logger.debug(`Decrypted workload URL: ${workloadUrl}`);

        // Process the headers
        const decryptedHeaders = await this.decryptData(
          Buffer.from(req.headers[this.config.polarisHeaderKey] as string, "base64url")
        );
        const workloadHeaders = JSON.parse(decryptedHeaders.toString());
        this.logger.debug(`Decrypted workload headers: ${Object.keys(workloadHeaders).join(", ")}`);

        // Process the body
        const bodyBuffer = await this.getRawBody(req);
        const workloadBody = bodyBuffer ? await this.decryptData(bodyBuffer) : undefined;
        this.logger.debug(`Decrypted workload body: ${workloadBody ? workloadBody.length : 0} bytes`);

        req.workloadRequest = {
          url: workloadUrl,
          headers: workloadHeaders,
          body: workloadBody,
          responsePublicKey,
        };
      } else {
        this.logger.debug("Pass through all request parameters");

        // Passthrough all request parameters
        req.workloadRequest = {
          url: `${req.baseUrl}${req.url === "/" ? "" : req.url}`,
          headers: req.headers as Record<string, string>,
          body: await this.getRawBody(req),
          responsePublicKey,
        };
      }

      next();
    } catch (error) {
      console.log(error);
      this.logger.error(`Error processing the request: ${error}`);
      next(error);
    }
  }

  polarisProxy(req: PolarisRequest, res: Response, next: NextFunction): void {
    proxy(this.config.workloadBaseUrl, {
      parseReqBody: false,

      proxyReqPathResolver: (proxyReq: Request) => {
        const url = req.workloadRequest?.url || `${req.baseUrl}${req.url === "/" ? "" : req.url}`;

        console.log("DBG:", req.workloadRequest?.url, url);

        getLogger().info(`Forwarding request to: ${url}`);

        return url;
      },

      proxyReqOptDecorator: (proxyReqOpts: RequestOptions, srcReq: Request) => {
        if (req.workloadRequest?.headers) {
          proxyReqOpts.headers = req.workloadRequest.headers;
        }

        return proxyReqOpts;
      },

      proxyReqBodyDecorator: (bodyContent: unknown, srcReq: Request) => {
        const body = req.workloadRequest?.body || bodyContent;
        return body;
      },

      userResDecorator: async (proxyRes, proxyResData, userReq, userRes) => {
        if (this.config.enableOutputEncryption) {
          if (!req.workloadRequest?.responsePublicKey) {
            throw new Error("Response public key is required for output encryption");
          }

          const encryptedResponse = await this.encryptResponse(
            proxyResData,
            req.workloadRequest?.responsePublicKey as string
          );

          return encryptedResponse.toString("base64");
        } else {
          return proxyResData;
        }
      },
    })(req, res, next);
  }
}
