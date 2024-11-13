/**
 * Interface representing the configuration settings.
 *
 * @property {string} workloadBaseUrl - The base URL for the workload.
 * @property {string} keyType - The type of key to use for encryption.
 * @property {boolean} enableLogging - Flag to enable logging.
 * @property {boolean} enableCORS - Flag to enable CORS preflight requests and headers.
 * @property {boolean} enableInputEncryption - Flag to enable encryption for input data.
 * @property {boolean} enableOutputEncryption - Flag to enable encryption for output data.
 * @property {string} polarisHeaderKey - Polaris Header Selector
 * @property {string} polariResponsePublicKeyHeader - Polar Response Public Key Header selector
 * @property {boolean} polarisContextRoute - Polaris Root Endpoint, i.e. 'polaris' for /polaris/*
 * @property {string} logLevel - The log level for the application.
 */
export interface Config {
  workloadBaseUrl: string;
  keyType: string;
  enableLogging: boolean;
  enableCORS: boolean;
  enableInputEncryption: boolean;
  enableOutputEncryption: boolean;
  polarisHeaderKey: string;
  polarisResponsePublicKeyHeader: string;
  polarisContextRoot: string;
  logLevel: string;
}
