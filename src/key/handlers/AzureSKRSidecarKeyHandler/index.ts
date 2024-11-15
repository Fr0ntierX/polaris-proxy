import { privateDecrypt, constants } from "crypto";

import axios from "axios";
import jwkToPem from "jwk-to-pem";

import { getConfigFromEnv } from "./utils";

import type { KeyHandler } from "@fr0ntier-x/polaris-sdk";

export class AzureSKRSidecarKeyHandler implements KeyHandler {
  private privateKey: string | undefined;
  private publicKey: string | undefined;

  constructor() {}

  async init() {
    const skrKeyConfig = getConfigFromEnv();
    const maxRetries = 5;
    const retryInterval = 60000;

    let attempt = 0;
    while (attempt < maxRetries) {
      try {
        attempt++;
        const { data } = await axios.post("http://localhost:8080/key/release", skrKeyConfig);
        const key = JSON.parse(data.key);

        this.privateKey = jwkToPem(key as jwkToPem.JWK, { private: true });
        this.publicKey = jwkToPem(key as jwkToPem.JWK);
        console.log("Key released successfully");
        return;
      } catch (error: any) {
        if (attempt < maxRetries) {
          console.warn(`Attempt ${attempt} failed. Retrying in ${retryInterval / 1000} seconds...`);
          await new Promise((resolve) => setTimeout(resolve, retryInterval));
        } else {
          throw new Error(`Failed to obtain key after ${maxRetries} attempts: ${error.message}`);
        }
      }
    }
  }

  async getPublicKey(): Promise<string> {
    if (!this.publicKey) {
      throw new Error("Public key not found");
    }
    return this.publicKey;
  }

  async unwrapKey(_wrappedKey: Buffer): Promise<Buffer> {
    if (!this.privateKey) {
      throw new Error("Private key not found");
    }

    const decryptedKey = privateDecrypt(
      {
        key: this.privateKey,
        padding: constants.RSA_PKCS1_OAEP_PADDING,
      },
      _wrappedKey
    );

    return decryptedKey;
  }
}
