import express from "express";
import axios from "axios";

const router = express.Router();
const CRIC_API = "https://api.cricapi.com/v1/cricScore";
const API_KEY = "381e1578-0453-4fe2-880d-d7dd99303dc4";

router.get("/matches", async (req, res) => {
  try {
    const type = req.query.type; // live | upcoming

    const { data } = await axios.get(CRIC_API, {
      params: { apikey: API_KEY },
      timeout: 10000,
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "application/json",
      },
    });

    let matches = data.data || [];

    if (type === "live") {
      matches = matches.filter((m) => m.ms === "live");
    }

    if (type === "upcoming") {
      matches = matches.filter((m) => m.ms === "fixture");
    }

    res.json({
      success: true,
      type: type || "all",
      count: matches.length,
      data: matches,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.response?.data || err.message,
    });
  }
});

export default router;
