import { Readable, Transform } from "stream";

import axios from "axios";
import proxy from "express-http-proxy";

import { getLogger } from "../../logging";

import type { Config } from "../../config/types";
import type { PolarisRequest } from "../types";
import type { PolarisSDK } from "@fr0ntier-x/polaris-sdk";
import type { AxiosRequestConfig, AxiosResponse } from "axios";
import type { NextFunction, Request, Response } from "express";
import type { RequestOptions } from "http";
import type { Logger } from "pino";

class EncryptStream extends Transform {
  private sdk: PolarisSDK;
  private publicKey: string;

  constructor(sdk: PolarisSDK, publicKey: string) {
    super();
    this.sdk = sdk;
    this.publicKey = publicKey;
  }

  async _transform(chunk: Buffer, encoding: string, callback: Function) {
    try {
      chunk = Buffer.from(chunk);
      const encryptedChunk = await this.sdk.encrypt(chunk, this.publicKey);
      this.push(encryptedChunk);
      callback();
    } catch (error) {
      callback(error);
    }
  }
}

export class PolarisProxyHandler {
  private readonly polarisSDK: PolarisSDK;
  private readonly config: Config;
  private readonly logger: Logger;
  private readonly axiosInstance = axios.create();

  constructor(polarisSDK: PolarisSDK, config: Config) {
    this.polarisSDK = polarisSDK;
    this.config = config;
    this.logger = getLogger();
    this.axiosInstance.interceptors.response.use(this.axiosStreamEncryptResponseInterceptor());
  }

  private axiosStreamEncryptResponseInterceptor(): (response: AxiosResponse) => Promise<AxiosResponse> {
    return async (response: AxiosResponse): Promise<AxiosResponse> => {
      const pubKey = response.config.headers[this.config.polarisResponsePublicKeyHeader];
      const publicKey = Buffer.from(pubKey, "base64").toString();
      if (response.data instanceof Readable) {
        const encryptTransform = new EncryptStream(this.polarisSDK, publicKey);
        response.data = response.data.pipe(encryptTransform);
        response.config.responseType = "stream";
      } else if (response.data instanceof Buffer) {
        response.data = await this.polarisSDK.encrypt(response.data, publicKey);
        response.config.responseType = "arraybuffer";
      } else if (typeof response.data === "string") {
        response.data = await this.polarisSDK.encrypt(Buffer.from(response.data), publicKey);
        response.config.responseType = "arraybuffer";
      } else if (response.data instanceof Uint8Array) {
        response.data = await this.polarisSDK.encrypt(Buffer.from(response.data.toString()), publicKey);
        response.config.responseType = "arraybuffer";
      }
      return response;
    };
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

  isStream(req: Request) {
    // Basic check: is req a readable stream?
    if (!(req instanceof Readable)) {
      return false;
    }

    // Additional checks for headers
    const contentType = req.headers["content-type"];
    const transferEncoding = req.headers["transfer-encoding"];

    // Optional: Adjust based on your use case
    if (transferEncoding === "chunked" || contentType === "application/octet-stream") {
      return true;
    }

    return false;
  }

  async polarisUnwrap(req: PolarisRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      // Check if the response public key is provided if output encryption is enabled
      if (this.config.enableOutputEncryption && !req.headers[this.config.polarisResponsePublicKeyHeader]) {
        throw new Error("Response public key is required for output encryption");
      }
      const responsePublicKey = this.config.enableOutputEncryption
        ? Buffer.from(req.headers[this.config.polarisResponsePublicKeyHeader] as string, "base64").toString()
        : undefined;

      // Process the request parameters
      if (this.config.enableInputEncryption) {
        // Process the URL
        const decryptedUrl = req.headers[this.config.polarisUrlHeaderKey]
          ? await this.decryptData(Buffer.from(req.headers[this.config.polarisUrlHeaderKey] as string, "base64"))
          : undefined;

        const workloadUrl = decryptedUrl ? decryptedUrl.toString() : req.baseUrl;
        this.logger.debug(`Decrypted workload URL: ${workloadUrl}`);

        // Process the headers
        const decryptedHeaders = req.headers[this.config.polarisHeaderKey]
          ? await this.decryptData(Buffer.from(req.headers[this.config.polarisHeaderKey] as string, "base64"))
          : undefined;

        const workloadHeaders = decryptedHeaders ? JSON.parse(decryptedHeaders.toString()) : undefined;
        this.logger.debug(
          `Decrypted workload headers: ${workloadHeaders ? Object.keys(workloadHeaders).join(", ") : ""}`
        );

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
    const isStream = req.headers["response-type"] == "stream";
    if (isStream) {
      this.axiosProxy(req, res, next);
    } else {
      this.expressHttpProxy(req, res, next);
    }
  }

  async expressHttpProxy(req: PolarisRequest, res: Response, next: NextFunction): Promise<void> {
    proxy(this.config.workloadBaseUrl, {
      parseReqBody: false,
      proxyReqPathResolver: (proxyReq: Request) => {
        const url = req.workloadRequest?.url || `${req.baseUrl}${req.url === "/" ? "" : req.url}`;
        getLogger().info(`Forwarding request to: ${url}`);
        return url.replace(/\/{2,}/g, "/").replace(":/", "://");
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
        if (this.config.enableOutputEncryption && req.workloadRequest?.responsePublicKey) {
          proxyResData = await this.polarisSDK.encrypt(proxyResData, req.workloadRequest?.responsePublicKey);
          return proxyResData.toString("base64");
        }
        return proxyResData;
      },
    })(req, res, next);
  }

  async axiosProxy(req: PolarisRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const url = req.workloadRequest?.url || `${req.baseUrl}${req.url === "/" ? "" : req.url}`;
      getLogger().info(`Forwarding request to: ${url}`);
      const target = url.replace(/\/{2,}/g, "/").replace(":/", "://");
      const axiosConfig: AxiosRequestConfig = {
        method: req.method,
        url: `${this.config.workloadBaseUrl}${target}`,
        headers: {
          [this.config.polarisResponsePublicKeyHeader]: req.headers[this.config.polarisResponsePublicKeyHeader],
          ...req.workloadRequest?.headers,
        },
        data: req.workloadRequest?.body,
        responseType: "stream",
      };
      const axiosResponse: AxiosResponse = await this.axiosInstance(axiosConfig);
      res.set(axiosResponse.headers);
      res.status(axiosResponse.status);
      axiosResponse.data.pipe(res);
    } catch (error) {
      getLogger().error(`Error in polarisProxy: ${error}`);
      next(error);
    }
  }
}
