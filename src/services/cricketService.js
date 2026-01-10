import CricketMatch from "../models/CricketMatch.js";

const API_KEY = "daf06269-b81c-4d17-9dab-21ee58c1baad";
const BASE_URL = "https://api.cricapi.com/v1";

// ✅ BULK FETCH (EXISTING – REQUIRED)
export const fetchAndStoreMatches = async () => {
  try {
    const response = await fetch(
      `${BASE_URL}/currentMatches?apikey=${API_KEY}&offset=0`
    );
    const data = await response.json();

    if (data.status !== "success") return;

    for (const match of data.data) {
      await CricketMatch.findOneAndUpdate(
        { apiMatchId: match.id },
        {
          name: match.name,
          matchType: match.matchType,
          status: match.status,
          venue: match.venue,
          date: match.date,
          dateTimeGMT: match.dateTimeGMT,
          teams: match.teams,
          score: match.score,
          tossWinner: match.tossWinner,
          tossChoice: match.tossChoice,
          matchWinner: match.matchWinner,
          hasSquad: match.hasSquad,
          lastUpdated: new Date(),
        },
        { upsert: true, new: true }
      );
    }
  } catch (err) {
    console.error("fetchAndStoreMatches error:", err.message);
  }
};

// 🔥 REAL-TIME MATCH DETAIL (JO HUMNE ADD KIYA)
export const getMatchDetails = async (matchId) => {
  const existingMatch = await CricketMatch.findById(matchId);
  if (!existingMatch) throw new Error("Match not found");

  const response = await fetch(
    `${BASE_URL}/match_info?apikey=${API_KEY}&id=${existingMatch.apiMatchId}`
  );
  const apiData = await response.json();

  if (apiData.status !== "success") {
    throw new Error("Live API fetch failed");
  }

  const liveMatch = apiData.data;

  return await CricketMatch.findByIdAndUpdate(
    matchId,
    {
      score: liveMatch.score,
      status: liveMatch.status,
      lastUpdated: new Date(),
    },
    { new: true }
  );
};
