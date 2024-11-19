import { privateDecrypt, constants } from "crypto";

import axios from "axios";
import jwkToPem from "jwk-to-pem";

import { getConfigFromEnv } from "./utils";

import { getLogger } from "../../../logging";

import type { KeyHandler } from "@fr0ntier-x/polaris-sdk";

export class AzureSKRSidecarKeyHandler implements KeyHandler {
  private privateKey: string | undefined;
  private publicKey: string | undefined;

  constructor() {}

  private async init() {
    const { maxSKRRequestRetries, skrRetryInterval, ...skrConfig } = getConfigFromEnv();

    let attempt = 0;
    while (attempt < maxSKRRequestRetries) {
      try {
        attempt++;
        const { data } = await axios.post("http://localhost:8080/key/release", skrConfig);
        const key = JSON.parse(data.key);

        this.privateKey = jwkToPem(key as jwkToPem.JWK, { private: true });
        this.publicKey = jwkToPem(key as jwkToPem.JWK);
        getLogger().info("Key released successfully");
        return;
      } catch (error: any) {
        if (attempt < maxSKRRequestRetries) {
          getLogger().warn(`Attempt ${attempt} failed. Retrying in ${skrRetryInterval / 1000} seconds...`);
          await new Promise((resolve) => setTimeout(resolve, skrRetryInterval));
        } else {
          throw new Error(`Failed to obtain key after ${maxSKRRequestRetries} attempts: ${error.message}`);
        }
      }
    }
  }

  async getPublicKey(): Promise<string> {
    if (!this.publicKey) {
      await this.init();

      if (!this.publicKey) {
        throw new Error("Public key could not be obtained from the Azure Vault");
      }
    }

    return this.publicKey;
  }

  async unwrapKey(_wrappedKey: Buffer): Promise<Buffer> {
    if (!this.privateKey) {
      await this.init();

      if (!this.privateKey) {
        throw new Error("Private key could not be obtained from the Azure Vault");
      }
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
