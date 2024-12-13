import { Readable } from "stream";

import {
  createAxiosRequestInterceptor,
  createAxiosResponseInterceptor,
  EphemeralKeyHandler,
  PolarisSDK,
} from "@fr0ntier-x/polaris-sdk";
import axios from "axios";
import express from "express";

import { getLogger } from "../../src/logging";
import { PolarisProxyHandler } from "../../src/proxy/handlers/PolarisProxyHandler";

import type { Config } from "../../src/config/types";
import type { NextFunction } from "express";
import type http from "http";

const axiosInstance = axios.create();

describe("PolarisProxyHandler End-to-End Encryption", () => {
  let mockConfig: Config;
  let handler: PolarisProxyHandler;
  let contextRoot = "";

  let polarisApp = express();

  const POLARIS_PORT = 4534;
  const WORKLOAD_PORT = 11434;

  let polarisServer: http.Server;
  const polarisSDK = new PolarisSDK(new EphemeralKeyHandler());

  process.env.POLARIS_CONTAINER_WORKLOAD_BASE_URL = `http://0.0.0.0:${WORKLOAD_PORT}`;

  // Mock Config
  mockConfig = {
    workloadBaseUrl: `http://0.0.0.0:${WORKLOAD_PORT}`,
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

  handler = new PolarisProxyHandler(polarisSDK, mockConfig);
  jest.setTimeout(15000); // Set timeout to 10 seconds (10000 ms)

  async function bootServers() {
    return new Promise((res, _rej) => {
      polarisServer = polarisApp
        .use(`/*`, handler.polarisUnwrap.bind(handler), handler.polarisProxy.bind(handler))
        .use((err: any, _req: express.Request, res: express.Response, _next: NextFunction) => {
          console.error(err.stack, err);
          res.status(500).send("Something broke!");
        })
        .listen(POLARIS_PORT, "localhost", () => {
          res(true);
        });
    });
  }

  async function closeServers() {
    await polarisServer.close();
  }

  beforeAll(async () => {
    await bootServers();
  });

  afterAll(async () => {
    await closeServers();
  });

  it("should handle encrypted proxy request with stream and axios", async () => {
    // Test data
    const testRequest = {
      path: "/api/chat",
      headers: { "content-type": "application/json", "response-type": "stream" },
      body: JSON.stringify({
        model: "llama3.1",
        messages: [{ role: "user", content: "hello" }],
      }),
    };

    // Client-side encryption
    const polarisUrl = `http://localhost:${POLARIS_PORT}`;
    const polarisBase = `${polarisUrl}/${contextRoot}`;

    // Create mock request with encrypted data
    axiosInstance.interceptors.request.use(
      createAxiosRequestInterceptor({
        polarisSDK,
        publicKey: await polarisSDK.getPublicKey(),
        enableOutputEncryption: mockConfig.enableOutputEncryption,
        polarisProxyBasePath: contextRoot,
      })
    );

    axiosInstance.interceptors.response.use(createAxiosResponseInterceptor({ polarisSDK }));

    const endpoint = `${polarisBase}${testRequest.path}`;

    let i = 0;

    const getData = () =>
      new Promise<Buffer>((res, rej) => {
        axiosInstance
          .post(endpoint, testRequest.body, {
            headers: testRequest.headers,
            responseType: "stream",
          })
          .then((response) => {
            const chunks: Buffer[] = [];
            if (response.data instanceof Readable) {
              response.data.on("data", async (chunk: Buffer) => {
                try {
                  chunks.push(chunk);
                  getLogger().info("pushing...", i++);
                  getLogger().info("got chunk", chunk.toString());
                } catch (error) {
                  getLogger().info(chunk.toString());
                }
              });
              response.data.on("end", async () => {
                getLogger().info("Response stream has ended.");
                res(Buffer.concat(chunks));
              });
              response.data.on("error", (err: Error) => {
                console.error("Streaming error: ", err.message);
                rej(err);
              });
            } else {
              res(response.data);
            }
          })
          .catch((error) => {
            console.error("Error making the request: ", error);
          });
      });

    const response = await getData();

    getLogger().info("collected chunks:", i);

    getLogger().info("chunks", i);
    getLogger().info("result:", response.toString());

    console.log(response.toString());

    expect(response.byteLength).toBeGreaterThan(0);
  });
});
