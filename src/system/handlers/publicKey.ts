import { polarisSDK } from "../../sdk";

import type { Request, Response } from "express";

export const publicKeyHandler = async (req: Request, res: Response) => {
  res.json({ publicKey: await polarisSDK.getPublicKey() });
};
