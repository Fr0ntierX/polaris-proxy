import {
  PolarisSDK,
  createAxiosRequestInterceptor,
  EphemeralKeyHandler,
  createAxiosResponseInterceptor,
} from "@fr0ntier-x/polaris-sdk";
import axios from "axios";
import express from "express";

import { getLogger } from "../../src/logging";
import { PolarisProxyHandler } from "../../src/proxy/handlers/PolarisProxyHandler";

import type { Config } from "../../src/config/types";
import type { NextFunction, Request } from "express";
import type http from "http";

const polarisSDK = new PolarisSDK(new EphemeralKeyHandler());

export const encryptDataForContainer = async (data: string): Promise<Buffer> => {
  try {
    const publicKey = await polarisSDK.getPublicKey();
    return polarisSDK.encrypt(Buffer.from(data), publicKey);
  } catch (error: any) {
    console.error(error);
    throw new Error(`Failed to encrypt data: ${error.message}`);
  }
};

describe("PolarisProxyHandler End-to-End Encryption", () => {
  let mockConfig: Config;
  let axiosHandler: PolarisProxyHandler;
  let contextRoot = "polaris-root";

  let polarisApp = express();
  let workloadApp = express();

  const POLARIS_PORT = 3431;
  const WORKLOAD_PORT = 3432;

  let polarisServer: http.Server;
  let workloadServer: http.Server;

  process.env.POLARIS_CONTAINER_WORKLOAD_BASE_URL = `http://localhost:${WORKLOAD_PORT}`;

  // Mock Config
  mockConfig = {
    workloadBaseUrl: `http://localhost:${WORKLOAD_PORT}`,
    keyType: "ephemeral",
    polarisContextRoot: contextRoot,
    polarisUrlHeaderKey: "polaris-url",
    polarisHeaderKey: "polaris-secure",
    polarisResponsePublicKeyHeader: "polaris-response-public-key",
    polarisResponseWrappedKeyHeader: "polaris-response-wrapped-key",
    enableInputEncryption: true,
    enableLogging: false,
    enableCORS: false,
    enableOutputEncryption: true,
    logLevel: "debug",
  };

  let workloadConfig = {
    enableOutputEncryption: true,
  };

  axiosHandler = new PolarisProxyHandler(polarisSDK, mockConfig);

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
        .get(`/polaris-container/publicKey`, async (req: express.Request, res: express.Response) => {
          res.json({ publicKey: await polarisSDK.getPublicKey() });
        })
        .use(
          `/${contextRoot}/*`,
          axiosHandler.polarisUnwrap.bind(axiosHandler),
          axiosHandler.polarisProxy.bind(axiosHandler)
        )
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

    const publicKey64 = Buffer.from(await polarisSDK.getPublicKey()).toString("base64");

    let result = await axios.post(endpoint, encryptedBody, {
      headers: {
        "Content-Type": "application/octet-stream",
        "polaris-response-public-key": publicKey64,
        "polaris-secure": encryptedHeaders.toString("base64"),
      },
      responseType: "arraybuffer",
    });

    const data = result.data?.length == 0 ? result.config.data : result.data;

    const clear = await polarisSDK.decrypt(Buffer.from(data));

    expect(clear.toString()).toEqual(testRequest.body);
  });

  it("should handle encrypted proxy request with axios interceptor", async () => {
    // Client-side encryption
    const polarisUrl = `http://localhost:${POLARIS_PORT}`;

    // Create mock request with encrypted data
    // Test data
    const testRequest = {
      path: "hello?world=1",
      headers: { "custom-header": "helloworld" },
      body: "helloWorld",
    };

    const basePath = `${polarisUrl}/${contextRoot}`;

    axios.interceptors.request.use(
      createAxiosRequestInterceptor({
        polarisSDK,
        publicKey: await polarisSDK.getPublicKey(),
        enableOutputEncryption: workloadConfig.enableOutputEncryption,
        polarisProxyBasePath: contextRoot,
      })
    );
    axios.interceptors.response.use(createAxiosResponseInterceptor({ polarisSDK }));

    const endpoint = `${basePath}/${testRequest.path}`;

    let result = await axios.post(endpoint, testRequest.body, {
      headers: testRequest.headers,
    });

    getLogger().info({ result: result.data.toString(), original: testRequest.body });

    expect(result.data.toString()).toEqual(testRequest.body);
  });
});
