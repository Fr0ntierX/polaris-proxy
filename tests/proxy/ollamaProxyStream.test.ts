import { Readable, Transform } from "stream";

import {
  createAxiosRequestInterceptor,
  createAxiosResponseInterceptor,
  EphemeralKeyHandler,
  PolarisSDK,
} from "@fr0ntier-x/polaris-sdk";
import axios from "axios";
import express from "express";

import { PolarisProxyHandler } from "../../src/proxy/handlers/PolarisProxyHandler";

import type { Config } from "../../src/config/types";
import type { AxiosResponse } from "axios";
import type { NextFunction } from "express";
import type http from "http";

const axiosInstance = axios.create();

class DecryptStream extends Transform {
  private sdk: PolarisSDK;
  constructor(sdk: PolarisSDK) {
    super();
    this.sdk = sdk;
  }

  async _transform(chunk: Buffer, encoding: string, callback: Function) {
    try {
      const decryptedChunk = await this.sdk.decrypt(chunk);
      this.push(decryptedChunk); // Push decrypted chunk to the next step
      callback(); // Indicate that the chunk has been processed
    } catch (error) {
      callback(error); // Propagate error
    }
  }
}

function logBuffer(buffer: Buffer, label: string) {
  try {
    console.log(`${label}:`, buffer.toString("hex").substring(0, 100), "...");
  } catch (error) {
    console.log(error);
  } finally {
    console.log("logBuffer done");
  }
}

describe("PolarisProxyHandler End-to-End Encryption", () => {
  let mockConfig: Config;
  let handler: PolarisProxyHandler;
  let contextRoot = "";

  let polarisApp = express();

  const POLARIS_PORT = 4565;
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

    // Function to handle the decryption of the body stream
    const decryptStreamData = (sdk: PolarisSDK, stream: Readable): Readable => {
      // Create a transform stream that will decrypt chunks
      const decryptTransform = new DecryptStream(sdk);

      // Pipe the input stream through the decryption transform stream
      return stream.pipe(decryptTransform);
    };

    function axiosStreamResponseInterceptor(sdk: PolarisSDK): (response: AxiosResponse) => Promise<AxiosResponse> {
      return async (response: AxiosResponse): Promise<AxiosResponse> => {
        // if (response.headers["polaris-read"]) return response;
        // response.headers["polaris-read"] = "ok";
        // Decrypt the body if it exists
        if (response.data instanceof Readable) {
          // Handle stream data with incremental decryption
          response.data = decryptStreamData(sdk, response.data);
          response.config.responseType = "stream";
        } else if (response.data) {
          // Handle regular data
          response.data = await sdk.decrypt(response.data);
          response.config.responseType = "arraybuffer";
        }
        return response;
      };
    }

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
            response.data.on("data", (chunk: Buffer) => {
              try {
                chunks.push(chunk);
                logBuffer(chunk, "got chunk");
              } catch (error) {
                logBuffer(chunk, "got chunk");
              }
            });
            response.data.on("end", async () => {
              logBuffer(Buffer.concat(chunks), "Response stream has ended.");
              res(Buffer.concat(chunks));
            });
            response.data.on("error", (err: Error) => {
              console.error("Streaming error: ", err.message);
              rej(err);
            });
          })
          .catch((error) => {
            console.error("Error making the request: ", error);
          });
      });

    const response = await getData();

    logBuffer(response, "collected chunks");
    expect(response.byteLength).toBeGreaterThan(0);
  });
});
