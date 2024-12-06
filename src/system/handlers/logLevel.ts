import type { NextFunction, Request, Response } from "express";
import { getLogger } from "../../logging";

export const logLevelHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ level: getLogger().level });
  } catch (err: any) {
    next(err);
  }
};
