import type { NextFunction, Request, Response } from "express";
/**
 * Middleware to handle errors and return proper responses.
 *
 * @param err
 * @param req
 * @param res
 * @param next
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const handleErrors = (err: any, req: Request, res: Response, next: NextFunction) => {
  req.log?.error(err);

  if (err instanceof Error) {
    res.status(400).json({ error: err.message });
    res.locals.errorReason = err.message;
  } else {
    res.status(500).json({ error: "Unknown error" });
    res.locals.errorReason = "Unknown error";
  }
};

export default handleErrors;
