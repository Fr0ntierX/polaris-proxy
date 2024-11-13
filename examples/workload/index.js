const express = require("express");

const workloadApp = express();

workloadApp
  .use(express.json())
  .post("/test", async (req, res) => {
    console.log("WORKLOAD: Processing workload request");

    const data = req.body?.data || "empty";

    res.json({ processedData: data.toUpperCase() });
    console.log("WORKLOAD: Workload request processed!");
  })
  .listen(3001);
