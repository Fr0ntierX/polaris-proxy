import type { AzureSKRSidecarKeyConfig } from "../types";

export const getConfigFromEnv = (): AzureSKRSidecarKeyConfig => {
  const maaEndpoint = process.env.MAA_ENDPOINT;
  const akvEndpoint = process.env.AKV_ENDPOINT;
  const kid = process.env.KID;
  const accessToken = process.env.ACCESS_TOKEN;

  if (!maaEndpoint) throw new Error("MAA_ENDPOINT environment variable not defined");
  if (!akvEndpoint) throw new Error("AKV_ENDPOINT environment variable not defined");
  if (!kid) throw new Error("KID environment variable not defined");

  return {
    maa_endpoint: maaEndpoint,
    akv_endpoint: akvEndpoint,
    kid,
    access_token: accessToken,
  };
};
