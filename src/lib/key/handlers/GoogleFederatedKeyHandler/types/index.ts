export interface GoogleFederatedKeyConfig {
  /** Audience for the attestation project */
  federatedCredentialsAudience?: string;

  /** Service account impersonation URL of the attestation project */
  federatedCredentialsServiceAccount?: string;

  /** Project ID of the key wrapping key */
  projectId: string;

  /** Location of the key wrapping key */
  location: string;

  /** Key ring ID of the key wrapping key */
  keyRingId: string;

  /** ID of the key wrapping key */
  keyId: string;
}
