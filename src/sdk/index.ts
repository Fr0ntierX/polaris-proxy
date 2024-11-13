import { PolarisSDK } from "@fr0ntier-x/polaris-sdk";
import { EphemeralKeyHandler } from "@fr0ntier-x/polaris-sdk/key/handlers/ephemeral";

import { getConfig } from "../config";
import { AzureSKRSidecarKeyHandler } from "../key/handlers/AzureSKRSidecarKeyHandler";
import { GoogleFederatedKeyHandler } from "../key/handlers/GoogleFederatedKeyHandler";

const createPolarisSDK = () => {
  switch (getConfig().keyType) {
    case "ephemeral":
      return new PolarisSDK(new EphemeralKeyHandler());
    case "google-federated":
      return new PolarisSDK(new GoogleFederatedKeyHandler());
    case "azure-skr":
      throw new AzureSKRSidecarKeyHandler();
    default:
      throw new Error("Invalid key type specified in configuration");
  }
};

export const polarisSDK = createPolarisSDK();
