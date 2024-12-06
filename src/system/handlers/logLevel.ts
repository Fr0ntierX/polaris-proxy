import type { NextFunction, Request, Response } from "express";
import { getConfig } from "../../config";

export const logLevelHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { enableLogging, logLevel } = getConfig();
    res.json({ level: enableLogging ? logLevel : "silent" });
  } catch (err: any) {
    next(err);
  }
};
