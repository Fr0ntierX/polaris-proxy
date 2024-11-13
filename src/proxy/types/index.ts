import type { Request } from "express";

export interface PolarisRequest extends Request {
  workloadRequest?: {
    url: string;
    headers: Record<string, string>;
    body?: Buffer;
    responsePublicKey?: string;
  };
}
