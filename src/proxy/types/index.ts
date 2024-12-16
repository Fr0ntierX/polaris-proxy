import type { AESKey } from "@fr0ntier-x/polaris-sdk/dist/crypto/types";
import type { Request } from "express";

export interface PolarisRequest extends Request {
  workloadRequest?: {
    url: string;
    headers: Record<string, string>;
    body?: any;
    responsePublicKey?: string;
    aesKey?: AESKey;
  };
}
