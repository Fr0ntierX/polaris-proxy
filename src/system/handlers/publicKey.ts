import { createPolarisSDK } from "../../sdk";

import type { NextFunction, Request, Response } from "express";

export const publicKeyHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const polarisSDK = await createPolarisSDK();

    res.json({ publicKey: await polarisSDK.getPublicKey() });
  } catch (err: any) {
    next(err);
  }
};
