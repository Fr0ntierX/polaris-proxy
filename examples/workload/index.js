const express = require("express");

const workloadApp = express();

workloadApp
  .use(express.json())
  .use("/*", async (req, res) => {
    console.log("WORKLOAD: Processing workload request");

    console.log("DBG:", { url: req.url, headers: req.headers, body: req.body });

    const data = req.body?.data || "empty";

    res.json({ processedData: data.toUpperCase() });
    WORKLOAD: console.log("WORKLOAD: Workload request processed!");
  })
  .listen(3001);
