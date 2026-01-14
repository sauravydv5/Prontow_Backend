import CricketMatch from "../models/CricketMatch.js";

const API_KEY = "381e1578-0453-4fe2-880d-d7dd99303dc4";
const BASE_URL = "https://api.cricapi.com/v1";

export const fetchAndStoreMatches = async () => {
  try {
    const response = await fetch(`${BASE_URL}/cricScore?apikey=${API_KEY}`);
    const json = await response.json();

    if (!json?.data) return [];

    const now = new Date();
    const activeMatchIds = [];

    const bulkOps = json.data
      .map((match) => {
        const matchDate = new Date(match.dateTimeGMT);
        const statusText = (match.status || "").toLowerCase();

        // ❌ Past & not live → ignore
        if (matchDate < now && match.ms !== "live") return null;

        activeMatchIds.push(match.id);

        return {
          updateOne: {
            filter: { apiMatchId: match.id },
            update: {
              $set: {
                apiMatchId: match.id,

                name: `${match.t1} vs ${match.t2}`,
                matchType: match.matchType,
                status: match.status,
                series: match.series || "",

                dateTimeGMT: matchDate,

                // 🏏 Teams
                teamAName: match.t1,
                teamBName: match.t2,

                // 🖼️ Images (IMPORTANT)
                teamAImg: match.t1img || "",
                teamBImg: match.t2img || "",

                // 📊 Scores
                teamAScore: match.t1s || "",
                teamBScore: match.t2s || "",

                // 🔥 FLAGS (ONLY RELIABLE SOURCE)
                isLive: match.ms === "live",
                isUpcoming: match.ms === "fixture",

                lastUpdated: new Date(),
              },
            },
            upsert: true,
          },
        };
      })
      .filter(Boolean);

    if (bulkOps.length > 0) {
      await CricketMatch.bulkWrite(bulkOps);
    }

    // 🔥 HARD CLEANUP
    await CricketMatch.deleteMany({
      dateTimeGMT: { $lt: now },
      isLive: false,
    });

    return true;
  } catch (err) {
    console.error("❌ fetchAndStoreMatches error:", err.message);
    return false;
  }
};
