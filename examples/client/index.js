const express = require("express");

const workloadApp = express();

workloadApp
  .use(express.json())
  .use("/*", async (req, res) => {
    console.log("WORKLOAD: Processing workload request");

    const data = req.body?.data || "empmty";

    res.json({ processedData: data.toUpperCase() });
    WORKLOAD: console.log("WORKLOAD: Workload request processed!");
  })
  .listen(3001);
