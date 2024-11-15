import type { AzureSKRSidecarKeyConfig } from "../types";

export const getConfigFromEnv = (): AzureSKRSidecarKeyConfig => {
  const maaEndpoint = process.env.POLARIS_CONTAINER_AZURE_SKR_MAA_ENDPOINT;
  const akvEndpoint = process.env.POLARIS_CONTAINER_AZURE_SKR_AKV_ENDPOINT;
  const kid = process.env.POLARIS_CONTAINER_AZURE_SKR_KID;
  const accessToken = process.env.POLARIS_CONTAINER_AZURE_SKR_ACCESS_TOKEN;
  const maxSKRRequestRetries = Number(process.env.POLARIS_CONTAINER_AZURE_SKR_MAX_REQUEST_RETRIES ?? 5);
  const skrRetryInterval = Number(process.env.POLARIS_CONTAINER_AZURE_SKR_RETRY_INTERVAL ?? 60000);

  if (!maaEndpoint) throw new Error("MAA_ENDPOINT environment variable not defined");
  if (!akvEndpoint) throw new Error("AKV_ENDPOINT environment variable not defined");
  if (!kid) throw new Error("KID environment variable not defined");

  return {
    maa_endpoint: maaEndpoint,
    akv_endpoint: akvEndpoint,
    kid,
    access_token: accessToken,
    maxSKRRequestRetries,
    skrRetryInterval,
  };
};
