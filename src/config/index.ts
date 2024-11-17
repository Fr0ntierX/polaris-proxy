import type { Config } from "./types";

let configCache: Config | undefined;

/**
 * Retrieves the configuration settings for the application.
 *
 * This function fetches configuration values from environment variables,
 * validates them, and caches the configuration to avoid redundant processing.
 *
 * @returns {Config} The configuration object
 *
 * @throws {Error} If the an obligatory configuration is not set.
 */
export const getConfig = () => {
  if (configCache) return configCache;

  // Get configuration from environmental variables
  const workloadBaseUrl = process.env.POLARIS_CONTAINER_WORKLOAD_BASE_URL;
  const enableLogging = process.env.POLARIS_CONTAINER_ENABLE_LOGGING === "true";
  const enableCORS = process.env.POLARIS_CONTAINER_ENABLE_CORS === "true";
  const enableInputEncryption = process.env.POLARIS_CONTAINER_ENABLE_INPUT_ENCRYPTION === "true";
  const enableOutputEncryption = process.env.POLARIS_CONTAINER_ENABLE_OUTPUT_ENCRYPTION === "true";
  const polarisUrlHeaderKey = process.env.POLARIS_CONTAINER_URL_HEADER_KEY || "polaris-url";
  const polarisHeaderKey = process.env.POLARIS_CONTAINER_HEADER_KEY || "polaris-secure";
  const polarisResponsePublicKeyHeader = process.env.POLARIS_CONTAINER_HEADER_KEY || "polaris-response-public-key";
  const polarisContextRoot = process.env.POLARIS_CONTAINER_CONTEXT_ROOT || "";
  const keyType = process.env.POLARIS_CONTAINER_KEY_TYPE || "ephemeral";
  const logLevel = process.env.POLARIS_CONTAINER_LOG_LEVEL || "info";

  // Validate configuration
  if (!workloadBaseUrl) throw new Error("POLARIS_CONTAINER_WORKLOAD_BASE_URL is required");

  // Cache and return configuration
  configCache = {
    workloadBaseUrl,
    keyType,
    enableLogging,
    enableCORS,
    enableInputEncryption,
    enableOutputEncryption,
    polarisUrlHeaderKey,
    polarisHeaderKey,
    polarisResponsePublicKeyHeader,
    polarisContextRoot,
    logLevel,
  };
  return configCache;
};
