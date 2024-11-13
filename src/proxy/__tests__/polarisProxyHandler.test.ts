import {
  axiosRequestInterceptor,
  axiosResponseInterceptor,
} from "@fr0ntier-x/polaris-sdk/interceptors/axiosInterceptors";
import axios from "axios";
import express from "express";

import { encryptDataForContainer, polarisSDK } from "../../system/handlers/publicKey";
import { PolarisProxyHandler } from "../polarisProxyHandler";

import type { Config } from "../../config/types";
import type { NextFunction, Request } from "express";
import type http from "http";

describe("PolarisProxyHandler End-to-End Encryption", () => {
  let mockConfig: Config;
  let handler: PolarisProxyHandler;
  let contextRoot = "polaris-root";

  let polarisApp = express();
  let workloadApp = express();

  const POLARIS_PORT = 3030;
  const WORKLOAD_PORT = 3031;

  let polarisServer: http.Server;
  let workloadServer: http.Server;

  process.env.POLARIS_CONTAINER_WORKLOAD_BASE_URL = `http://localhost:${WORKLOAD_PORT}`;

  // Mock Config
  mockConfig = {
    workloadBaseUrl: `http://localhost:${WORKLOAD_PORT}`,
    polarisContextRoot: contextRoot,
    polarisHeaderKey: "polaris-secure",
    enableInputEncryption: true,
    enableLogging: false,
    enableCORS: false,
    enableOutputEncryption: true,
  };

  let workloadConfig = {
    enableOutputEncryption: true,
  };

  handler = new PolarisProxyHandler(polarisSDK, mockConfig);

  const rawBody = async (req: Request): Promise<Buffer | undefined> => {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      req.on("data", (chunk: Buffer) => chunks.push(chunk));
      req.on("end", () => resolve(chunks.length ? Buffer.concat(chunks) : undefined));
      req.on("error", (err: Error) => reject(err));
    });
  };

  async function bootServers() {
    return new Promise((res, _rej) => {
      polarisServer = polarisApp
        .use(`/${contextRoot}/*`, handler.polarisUnwrap.bind(handler), handler.polarisProxy.bind(handler))
        .use((err: any, _req: express.Request, res: express.Response, _next: NextFunction) => {
          console.error(err.stack, err);
          res.status(500).send("Something broke!");
        })
        .listen(POLARIS_PORT, "localhost", () => {
          workloadServer = workloadApp
            .use("/*", async (req, res) => {
              const body = await rawBody(req);
              if (!body) {
                res.status(200);
              } else {
                res.send(
                  workloadConfig.enableOutputEncryption
                    ? await polarisSDK.encrypt(body, await polarisSDK.getPublicKey())
                    : body
                );
              }
            })
            .listen(WORKLOAD_PORT, "localhost", () => {
              res(true);
            });
        });
    });
  }

  async function closeServers() {
    await polarisServer.close();
    await workloadServer.close();
  }

  beforeAll(async () => {
    await bootServers();
  });

  afterAll(async () => {
    await closeServers();
  });

  it("should handle encrypted proxy request with query params, body and headers", async () => {
    try {
      // Test data
      const testRequest = {
        path: "hello?world=1",
        headers: { "custom-header": "helloworld" },
        body: "helloWorld",
      };

      // Client-side encryption
      const polarisUrl = `http://localhost:${POLARIS_PORT}`;

      // encryptions
      const encryptedPath = await encryptDataForContainer(testRequest.path);
      const encryptedHeaders = await encryptDataForContainer(JSON.stringify(testRequest.headers));
      const encryptedBody = await encryptDataForContainer(testRequest.body);

      // raw Check
      const clearPath = await polarisSDK.decrypt(encryptedPath);
      expect(clearPath.toString()).toEqual(testRequest.path);

      // Create mock request with encrypted data
      const endpoint = `${polarisUrl}/${contextRoot}/${encryptedPath.toString("hex")}`;

      let result = await axios.post(endpoint, encryptedBody, {
        headers: {
          "Content-Type": "application/octet-stream",
          "polaris-secure": encryptedHeaders.toString("hex"),
        },
        responseType: "arraybuffer",
      });

      console.log("result bytesLen", result.data.length);

      const roundOne = await polarisSDK.decrypt(result.data);
      console.log("round one decrypted");

      const roundTwo = await polarisSDK.decrypt(roundOne);
      console.log("roundTwo:", roundTwo.toString());

      expect(roundTwo.toString()).toEqual(testRequest.body);
    } catch (err) {
      console.error("got error", err);
    }
  });

  it("should handle encrypted proxy request with axios interceptor", async () => {
    try {
      // Client-side encryption
      const polarisUrl = `http://localhost:${POLARIS_PORT}`;

      // Create mock request with encrypted data
      // Test data
      const testRequest = {
        path: "hello?world=1",
        headers: { "custom-header": "helloworld" },
        body: "helloWorld",
      };

      const polarisBase = `${polarisUrl}/${contextRoot}`;

      axios.interceptors.request.use(axiosRequestInterceptor(polarisBase, polarisSDK));
      axios.interceptors.response.use(axiosResponseInterceptor(polarisSDK));

      const endpoint = `${polarisBase}/${testRequest.path}`;

      let result = await axios.post(endpoint, testRequest.body, {
        headers: testRequest.headers,
        responseType: "arraybuffer",
      });
      console.log("axios result bytesLen", result.data.length);

      if (workloadConfig.enableOutputEncryption) {
        result.data = await polarisSDK.decrypt(result.data);
        console.log("axios round 2 bytesLen", result.data.length);
      }

      expect(result.data.toString()).toEqual(testRequest.body);
    } catch (err) {
      console.error("got error", err);
    } finally {
    }
  });
});
