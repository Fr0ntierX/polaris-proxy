import { polarisSDK } from "../../sdk";

import type { NextFunction, Request, Response } from "express";

export const publicKeyHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ publicKey: await polarisSDK.getPublicKey() });
  } catch (err: any) {
    next(err);
  }
};
