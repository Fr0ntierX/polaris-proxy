import pino from "pino";

import { getConfig } from "../config";

import type { Logger } from "pino";

let logger: Logger | undefined;

/**
 * Returns a singleton instance of the logger.
 *
 * @returns {Logger} The logger instance.
 */
export const getLogger = (): Logger => {
  const { enableLogging, logLevel } = getConfig();

  if (!logger) {
    logger = pino({ level: enableLogging ? logLevel : "silent" });
  }

  return logger;
};
