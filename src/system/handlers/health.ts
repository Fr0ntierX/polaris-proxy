import type { Request, Response } from "express";

/**
 * Handles health check requests.
 *
 * @param req - The request object.
 * @param res - The response object.
 * @returns A JSON response with the status of the service.
 */
export const healthHandler = (req: Request, res: Response) => {
  res.json({ status: "OK" });
};
