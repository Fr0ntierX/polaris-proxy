import { KeyManagementServiceClient } from "@google-cloud/kms";

import { getConfigFromEnv } from "./utils";

import type { KeyHandler } from "@fr0ntier-x/polaris-sdk";

export class GoogleFederatedKeyHandler implements KeyHandler {
  private keyWrappingKeyName: string;

  private keyWrappingKeyKMSClient: KeyManagementServiceClient;

  constructor() {
    const config = getConfigFromEnv();

    const credentials = {
      type: "external_account",
      audience: config.federatedCredentialsAudience,
      service_account_impersonation_url: config.federatedCredentialsServiceAccount,
      subject_token_type: "urn:ietf:params:oauth:token-type:jwt",
      token_url: "https://sts.googleapis.com/v1/token",
      credential_source: {
        file: "/run/container_launcher/attestation_verifier_claims_token",
      },
    };

    this.keyWrappingKeyKMSClient = new KeyManagementServiceClient({ credentials });
    this.keyWrappingKeyName = this.keyWrappingKeyKMSClient.cryptoKeyVersionPath(
      config.projectId,
      config.location,
      config.keyRingId,
      config.keyId,
      "latest"
    );
  }

  async unwrapKey(wrappedKey: Buffer): Promise<Buffer> {
    const [decryptResponse] = await this.keyWrappingKeyKMSClient.asymmetricDecrypt({
      name: this.keyWrappingKeyName,
      ciphertext: wrappedKey,
    });

    const decryptedKey = decryptResponse?.plaintext;
    if (!decryptedKey) throw new Error("Decryption error");

    return Buffer.from(decryptedKey);
  }

  async getPublicKey(): Promise<string> {
    const [publicKey] = await this.keyWrappingKeyKMSClient.getPublicKey({
      name: this.keyWrappingKeyName,
    });

    if (!publicKey?.pem) throw new Error("Public key not found");

    return publicKey.pem;
  }
}
