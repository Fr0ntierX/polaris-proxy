import { Buffer } from "buffer";

import { PolarisSDK } from "../../lib/polaris-sdk";
import { EphemeralKeyHandler } from "../../lib/polaris-sdk/key/handlers/ephemeral";

import type { Request, Response } from "express";

export const polarisSDK = new PolarisSDK(new EphemeralKeyHandler());

export const publicKeyHandler = async (req: Request, res: Response) => {
  res.json({ publicKey: await polarisSDK.getPublicKey() });
};

export const encryptDataForContainer = async (data: string): Promise<Buffer> => {
  try {
    const publicKey = await polarisSDK.getPublicKey();
    return polarisSDK.encrypt(Buffer.from(data), publicKey);
  } catch (error: any) {
    console.error(error);
    throw new Error(`Failed to encrypt data: ${error.message}`);
  }
};
