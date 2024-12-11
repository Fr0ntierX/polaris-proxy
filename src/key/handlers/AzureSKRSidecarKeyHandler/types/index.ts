export interface AzureSKRSidecarKeyConfig {
  keyReleaseEndpoint: string;
  maa_endpoint: string;
  akv_endpoint: string;
  kid: string;
  access_token?: string;
  maxSKRRequestRetries: number;
  skrRetryInterval: number;
}
