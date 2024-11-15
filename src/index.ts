import cors from "cors";
import express from "express";
import helmet from "helmet";

import { getConfig } from "./config";
import { getLogger } from "./logging";
import handleErrors from "./middleware/handleErrors";
import { registerEncryptionProxy } from "./proxy";
import { registerSystemEndpoints } from "./system";

// Create the Express server
const app = express();

app.set("trust proxy", true);

app.use(
  helmet({
    strictTransportSecurity: {
      maxAge: 31536000,
    },
  })
);

// Get the configuration
const { enableCORS } = getConfig();

if (enableCORS) {
  app.use(
    cors({
      origin: "*",
      methods: ["GET", "POST", "PUT", "DELETE"],
    })
  );
}
try {
  // Register Polaris Container system endpoints
  registerSystemEndpoints(app);

  // Register the encryption proxy
  (async () => {
    await registerEncryptionProxy(app);
  })();
} catch (err: any) {
  console.log(err);
}

app.use(handleErrors);

// Enable CORS preflight requests
if (enableCORS) {
  app.options("*", cors());
}

// Start the server
const port = process.env.PORT || 3000;
app.listen(port);

getLogger().info(`Polaris Container started on port ${port}`);
