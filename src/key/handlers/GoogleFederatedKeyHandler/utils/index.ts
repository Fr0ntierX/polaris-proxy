import type { GoogleFederatedKeyConfig } from "../types";

export const getConfigFromEnv = (): GoogleFederatedKeyConfig => {
  // Get all values from the environment variables
  const projectId = process.env.POLARIS_CONTAINER_GOOGLE_FEDERATED_KEY_PROJECT_ID;
  const location = process.env.POLARIS_CONTAINER_GOOGLE_FEDERATED_KEY_LOCATION;
  const keyRingId = process.env.POLARIS_CONTAINER_GOOGLE_FEDERATED_KEY_RING_ID;
  const keyId = process.env.POLARIS_CONTAINER_GOOGLE_FEDERATED_KEY_ID;
  const federatedCredentialsAudience = process.env.POLARIS_CONTAINER_GOOGLE_FEDERATED_KEY_AUDIENCE;
  const federatedCredentialsServiceAccount = process.env.POLARIS_CONTAINER_GOOGLE_FEDERATED_KEY__SERVICE_ACCOUNT;

  // Check that all values are properly defined
  if (!projectId) throw new Error("POLARIS_CONTAINER_GOOGLE_FEDERATED_KEY_PROJECT_ID environment variable not defined");
  if (!location) throw new Error("POLARIS_CONTAINER_GOOGLE_FEDERATED_KEY_LOCATION environment variable not defined");
  if (!keyRingId) throw new Error("POLARIS_CONTAINER_GOOGLE_FEDERATED_KEY_RING_ID environment variable not defined");
  if (!keyId) throw new Error("POLARIS_CONTAINER_GOOGLE_FEDERATED_KEY_ID environment variable not defined");
  if (!federatedCredentialsAudience)
    throw new Error("POLARIS_CONTAINER_GOOGLE_FEDERATED_KEY_AUDIENCE environment variable not defined");
  if (!federatedCredentialsServiceAccount)
    throw new Error("POLARIS_CONTAINER_GOOGLE_FEDERATED_KEY__SERVICE_ACCOUNT environment variable not defined");

  return {
    federatedCredentialsAudience,
    federatedCredentialsServiceAccount,
    projectId,
    location,
    keyRingId,
    keyId,
  };
};

/**
 * Create a credentials object for accessing GCP resources
 *
 * In dev mode, we are using directly a service account, while in production, we use a workload identity pool
 *
 * @param config Server config
 * @returns
 */
export const getGCPCredentials = (config: GoogleFederatedKeyConfig) => {
  return {
    type: "external_account",
    audience: config.federatedCredentialsAudience,
    service_account_impersonation_url: config.federatedCredentialsServiceAccount,
    subject_token_type: "urn:ietf:params:oauth:token-type:jwt",
    token_url: "https://sts.googleapis.com/v1/token",
    credential_source: {
      file: "/run/container_launcher/attestation_verifier_claims_token",
    },
  };
};
