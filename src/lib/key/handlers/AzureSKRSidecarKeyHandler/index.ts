import type { KeyHandler } from "../../../polaris-sdk/key/types";

export class AzureSKRSidecarKeyHandler implements KeyHandler {
  getPublicKey(): Promise<string> {
    throw new Error("Method not implemented.");
  }
  unwrapKey(_wrappedKey: Buffer): Promise<Buffer> {
    throw new Error("Method not implemented.");
  }
}
