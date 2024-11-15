export interface AzureSKRSidecarKeyConfig {
  maa_endpoint: string;
  akv_endpoint: string;
  kid: string;
  access_token?: string;
  maxSKRRequestRetries: number;
  skrRetryInterval: number;
}
