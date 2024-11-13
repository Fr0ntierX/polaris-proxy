/**
 * Interface representing the configuration settings.
 *
 * @property {string} workloadBaseUrl - The base URL for the workload.
 * @property {boolean} enableLogging - Flag to enable logging.
 * @property {boolean} enableCORS - Flag to enable CORS preflight requests and headers.
 * @property {boolean} enableInputEncryption - Flag to enable encryption for input data.
 * @property {boolean} enableOutputEncryption - Flag to enable encryption for output data.
 * @property {string} polarisHeaderKey - Polaris Header Selector
 * @property {boolean} polarisContextRoute - Polaris Root Endpoint, i.e. 'polaris' for /polaris/*
 */
export interface Config {
  workloadBaseUrl: string;
  enableLogging: boolean;
  enableCORS: boolean;
  enableInputEncryption: boolean;
  enableOutputEncryption: boolean;
  polarisHeaderKey: string;
  polarisContextRoot: string;
}