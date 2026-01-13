import axios from "axios";
import { emitLiveScoreUpdate } from "./socketService.js";

const CRIC_API = "https://api.cricapi.com/v1/cricScore";
const API_KEY = "381e1578-0453-4fe2-880d-d7dd99303dc4";

export const startLiveScoreWorker = async () => {
  try {
    const response = await axios.get(CRIC_API, {
      params: { apikey: API_KEY },
      timeout: 10000,
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "application/json",
      },
    });

    const matches = response.data?.data || [];
    const liveMatches = matches.filter((m) => m.ms === "live");

    console.log("LIVE MATCH COUNT:", liveMatches.length);

    if (liveMatches.length > 0) {
      emitLiveScoreUpdate(liveMatches);
    }
  } catch (err) {
    console.error("LiveScoreWorker error:", err.response?.data || err.message);
  }
};
