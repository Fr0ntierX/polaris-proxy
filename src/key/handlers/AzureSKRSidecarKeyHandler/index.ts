import type { KeyHandler } from "@fr0ntier-x/polaris-sdk";

export class AzureSKRSidecarKeyHandler implements KeyHandler {
  getPublicKey(): Promise<string> {
    throw new Error("Method not implemented.");
  }
  unwrapKey(_wrappedKey: Buffer): Promise<Buffer> {
    throw new Error("Method not implemented.");
  }
}
