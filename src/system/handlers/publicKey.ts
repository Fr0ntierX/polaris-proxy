import { createPolarisSDK } from "../../sdk";

import type { Request, Response } from "express";

export const publicKeyHandler = async (req: Request, res: Response) => {
  const polarisSDK = await createPolarisSDK();

  res.json({ publicKey: await polarisSDK.getPublicKey() });
};
