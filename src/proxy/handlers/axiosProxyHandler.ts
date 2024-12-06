import { Readable, Transform } from "stream";

import axios from "axios";

import { getLogger } from "../../logging";

import type { Config } from "../../config/types";
import type { PolarisRequest } from "../types";
import type { PolarisSDK } from "@fr0ntier-x/polaris-sdk";
import type { AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from "axios";
import type { NextFunction, Request, Response } from "express";
import type { Logger } from "pino";

export class DecryptStream extends Transform {
  private sdk: PolarisSDK;
  constructor(sdk: PolarisSDK) {
    super();
    this.sdk = sdk;
  }

  async _transform(chunk: Buffer, encoding: string, callback: Function) {
    try {
      const decryptedChunk = await this.sdk.decrypt(chunk);
      this.push(decryptedChunk);
      callback();
    } catch (error) {
      callback(error);
    }
  }
}

export const decryptStreamData = (sdk: PolarisSDK, stream: Readable): Readable => {
  const decryptTransform = new DecryptStream(sdk);
  return stream.pipe(decryptTransform);
};

export function axiosProxyResponseInterceptor(sdk: PolarisSDK): (response: AxiosResponse) => Promise<AxiosResponse> {
  return async (response: AxiosResponse): Promise<AxiosResponse> => {
    const rspData = response.data;
    const cnfData = response.config.data;
    const data = rspData instanceof Readable ? rspData : cnfData;
    if (data instanceof Readable) {
      response.data = decryptStreamData(sdk, data);
      response.config.responseType = "stream";
    } else if (response.config.data) {
      response.data = await sdk.decrypt(data);
      response.config.responseType = "arraybuffer";
    }
    return response;
  };
}

export class AxiosProxyHandler {
  private readonly polarisSDK: PolarisSDK;
  private readonly config: Config;
  private readonly logger: Logger;
  private readonly axiosInstance = axios.create();

  constructor(polarisSDK: PolarisSDK, config: Config) {
    this.polarisSDK = polarisSDK;
    this.config = config;
    this.logger = getLogger();
  }

  private async decryptData(data: Buffer): Promise<Buffer> {
    return await this.polarisSDK.decrypt(data);
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

        req.workloadRequest = {
          url: workloadUrl,
          headers: workloadHeaders,
          responsePublicKey,
        };
      } else {
        this.logger.debug("Pass through all request parameters");

        // Passthrough all request parameters
        req.workloadRequest = {
          url: `${req.baseUrl}${req.url === "/" ? "" : req.url}`,
          headers: req.headers as Record<string, string>,
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

  logBuffer(buffer: Buffer, label: string) {
    console.log(`${label}:`, buffer.toString("hex").substring(0, 100), "...");
    console.log(buffer.toString().substring(0, 100), "...");
  }

  polarisProxy(req: PolarisRequest, res: Response, next: NextFunction): void {
    this.axiosProxy(req, res, next);
  }

  async axiosProxy(req: PolarisRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const url = req.workloadRequest?.url || `${req.baseUrl}${req.url === "/" ? "" : req.url}`;
      getLogger().info(`Forwarding request to: ${url}`);
      const target = url.replace(/\/{2,}/g, "/").replace(":/", "://");

      let config: AxiosRequestConfig = {
        method: req.method,
        url: `${this.config.workloadBaseUrl}${target}`,
        headers: {
          [this.config.polarisResponsePublicKeyHeader]: req.headers[this.config.polarisResponsePublicKeyHeader],
          ...req.workloadRequest?.headers,
        },
        responseType: "stream",
      };

      const requestInterceptor = this.axiosInstance.interceptors.request.use(
        (requestConfig: InternalAxiosRequestConfig) => {
          const decryptStream = new Readable();
          decryptStream._read = () => {};
          req.on("data", async (chunk: any) => {
            this.logBuffer(chunk, "Request Chunk Before Decryption");
            if (this.config.enableInputEncryption) {
              if (chunk instanceof Buffer) {
                chunk = await this.polarisSDK.decrypt(chunk);
              } else {
                chunk = await this.polarisSDK.decrypt(Buffer.from(chunk));
              }
              this.logBuffer(chunk, "Request Chunk After Decryption");
            } else {
              this.logBuffer(chunk, "Request Chunk After NoDecryption");
            }
            decryptStream.push(chunk);
          });
          req.on("end", () => {
            decryptStream.push(null);
          });
          requestConfig.data = decryptStream;
          return requestConfig;
        }
      );

      const responseInterceptor = this.axiosInstance.interceptors.response.use((response: AxiosResponse) => {
        const encryptStream = new Readable();
        encryptStream._read = () => {};
        response.data.on("data", async (chunk: any) => {
          this.logBuffer(chunk, "Response Chunk Before Encryption");
          if (this.config.enableOutputEncryption) {
            const pubKey = response.config.headers[this.config.polarisResponsePublicKeyHeader];
            const publicKey = Buffer.from(pubKey, "base64").toString();
            if (chunk instanceof Buffer) {
              chunk = await this.polarisSDK.encrypt(chunk, publicKey);
            } else {
              chunk = await this.polarisSDK.encrypt(Buffer.from(chunk), publicKey);
            }
            this.logBuffer(chunk, "Response Chunk After Encryption");
            encryptStream.push(chunk);
          } else {
            this.logBuffer(chunk, "Response Chunk After NoEncryption");
            encryptStream.push(chunk);
          }
        });
        response.data.on("end", () => {
          encryptStream.push(null);
        });
        response.data = encryptStream;
        response.config.responseType = "stream";
        return response;
      });

      this.axiosInstance(config)
        .then((response: AxiosResponse) => {
          response.data.pipe(res);
        })
        .catch((error) => {
          console.error("Error in proxy:", error);
          res.status(500).send("Proxy Error");
        })
        .finally(() => {
          this.axiosInstance.interceptors.request.eject(requestInterceptor);
          this.axiosInstance.interceptors.response.eject(responseInterceptor);
        });
    } catch (error) {
      getLogger().error(`Error in polarisProxy: ${error}`);
      next(error);
    }
  }
}
