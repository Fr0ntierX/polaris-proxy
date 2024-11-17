import { PolarisSDK, EphemeralKeyHandler } from "@fr0ntier-x/polaris-sdk";

import { getConfig } from "../config";
import { AzureSKRSidecarKeyHandler } from "../key/handlers/AzureSKRSidecarKeyHandler";
import { GoogleFederatedKeyHandler } from "../key/handlers/GoogleFederatedKeyHandler";

export const createPolarisSDK = () => {
  switch (getConfig().keyType) {
    case "ephemeral":
      return new PolarisSDK(new EphemeralKeyHandler());
    case "google-federated":
      return new PolarisSDK(new GoogleFederatedKeyHandler());
    case "azure-skr":
      return new PolarisSDK(new AzureSKRSidecarKeyHandler());
    default:
      throw new Error("Invalid key type specified in configuration");
  }
};

export const polarisSDK = createPolarisSDK();
