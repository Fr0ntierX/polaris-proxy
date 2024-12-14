import { Readable } from "stream";

import { createAxiosResponseInterceptor, DecryptStream, type PolarisSDK } from "@fr0ntier-x/polaris-sdk";
import axios from "axios";

import { getLogger } from "../../logging";

import type { Config } from "../../config/types";
import type { PolarisRequest } from "../types";
import type { AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from "axios";
import type { NextFunction, Response } from "express";
import type { Logger } from "pino";
import { stringify } from "querystring";
import { AESKey } from "@fr0ntier-x/polaris-sdk/dist/crypto/types";

export const decryptStreamData = (sdk: PolarisSDK, stream: Readable): Readable => {
  const decryptTransform = new DecryptStream(sdk);
  return stream.pipe(decryptTransform);
};

export class PolarisProxyHandler {
  private readonly polarisSDK: PolarisSDK;
  private readonly config: Config;
  private readonly logger: Logger;
  private readonly axiosInstance = axios.create();

  constructor(polarisSDK: PolarisSDK, config: Config) {
    this.polarisSDK = polarisSDK;
    this.config = config;
    this.logger = getLogger();
  }

  private async decryptData(data: Buffer, aesKey?: AESKey): Promise<Buffer> {
    if (aesKey) {
      let decrypted = await this.polarisSDK.decryptWithPresetKey(data, aesKey);
      return Buffer.from(decrypted);
    } else {
      return await this.polarisSDK.decrypt(data);
    }
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

      let aesKey: AESKey | undefined = undefined;
      const wrappedKeyIv = req.headers[this.config.polarisResponseWrappedKeyHeader] as string;
      if (wrappedKeyIv) {
        const wrappedKeyIvArray = wrappedKeyIv.split(":");
        const key = await this.polarisSDK.unwrapKey(Buffer.from(wrappedKeyIvArray[0], "base64"));
        const iv = await this.polarisSDK.unwrapKey(Buffer.from(wrappedKeyIvArray[1], "base64"));
        aesKey = {
          key,
          iv,
        };
      }

      // Process the request parameters
      if (this.config.enableInputEncryption) {
        // Process the URL
        const decryptedUrl = req.headers[this.config.polarisUrlHeaderKey]
          ? await this.decryptData(
              Buffer.from(req.headers[this.config.polarisUrlHeaderKey] as string, "base64"),
              aesKey
            )
          : undefined;

        const workloadUrl = decryptedUrl ? decryptedUrl.toString() : req.baseUrl;
        this.logger.debug(`Decrypted workload URL: ${workloadUrl}`);

        // Process the headers
        const decryptedHeaders = req.headers[this.config.polarisHeaderKey]
          ? await this.decryptData(Buffer.from(req.headers[this.config.polarisHeaderKey] as string, "base64"), aesKey)
          : undefined;

        const workloadHeaders = decryptedHeaders ? JSON.parse(decryptedHeaders.toString()) : undefined;
        this.logger.debug(
          `Decrypted workload headers: ${workloadHeaders ? Object.keys(workloadHeaders).join(", ") : ""}`
        );

        req.workloadRequest = {
          url: workloadUrl,
          headers: workloadHeaders,
          responsePublicKey,
          aesKey,
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
    try {
      console.log(`${label}:`, buffer.toString("hex").substring(0, 100), "...");
    } catch (error) {
      console.log(error);
    } finally {
      console.log("logBuffer done");
    }
  }

  async polarisProxy(req: PolarisRequest, res: Response, next: NextFunction): Promise<void> {
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
                chunk = await this.decryptData(chunk, req.workloadRequest?.aesKey);
              } else {
                chunk = await this.decryptData(Buffer.from(chunk), req.workloadRequest?.aesKey);
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

      let aesKey = await this.polarisSDK.createRandomAESKey();
      const pubKey = req.headers[this.config.polarisResponsePublicKeyHeader]! as string;
      const publicKey = Buffer.from(pubKey, "base64").toString();

      const wrappedKey = await this.polarisSDK.wrapKey(aesKey.key, publicKey);
      const wrappedKeyB64 = wrappedKey.toString("base64");
      const wrappedIv = await this.polarisSDK.wrapKey(aesKey.iv, publicKey);
      const wrappedIvB64 = wrappedIv.toString("base64");
      const wrappedKeyIV = `${wrappedKeyB64}:${wrappedIvB64}`;
      res.setHeader(this.config.polarisResponseWrappedKeyHeader, wrappedKeyIV);

      const responseInterceptor = this.axiosInstance.interceptors.response.use((response: AxiosResponse) => {
        const encryptStream = new Readable();
        encryptStream._read = () => {};
        response.data.on("data", async (chunk: any) => {
          this.logBuffer(chunk, "Response Chunk Before Encryption");
          if (this.config.enableOutputEncryption) {
            if (chunk instanceof Buffer) {
              // chunk = await this.polarisSDK.encrypt(chunk, publicKey);
            } else {
              chunk = Buffer.from(chunk);
              // chunk = await this.polarisSDK.encrypt(Buffer.from(chunk), publicKey);
            }
            chunk = await this.polarisSDK.encryptWithPresetKey(chunk, aesKey);
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
