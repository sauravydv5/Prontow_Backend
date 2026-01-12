import CricketMatch from "../models/CricketMatch.js";

const API_KEY = "381e1578-0453-4fe2-880d-d7dd99303dc4";
const BASE_URL = "https://api.cricapi.com/v1";

/* =====================================================
   🔄 BULK FETCH (LIVE + UPCOMING ONLY)
===================================================== */
export const fetchAndStoreMatches = async () => {
  try {
    console.log("🔵 CricAPI call start ho rahi hai...");

    const response = await fetch(
      `${BASE_URL}/currentMatches?apikey=${API_KEY}&offset=0`
    );

    const data = await response.json();

    console.log("🟢 API Status:", data.status);
    console.log("🟢 Total Matches from API:", data.data?.length);

    if (data.status !== "success") return [];

    const savedMatches = [];

    for (const match of data.data) {
      const saved = await CricketMatch.findOneAndUpdate(
        { apiMatchId: match.id },
        {
          apiMatchId: match.id,
          name: match.name,
          matchType: match.matchType,
          status: match.status,
          venue: match.venue,

          date: match.date ? new Date(match.date) : null,
          dateTimeGMT: match.dateTimeGMT ? new Date(match.dateTimeGMT) : null,

          score: match.score || [],
          tossWinner: match.tossWinner,
          tossChoice: match.tossChoice,
          matchWinner: match.matchWinner,
          hasSquad: match.hasSquad,

          lastUpdated: new Date(),
        },
        {
          upsert: true,
          new: true,
          runValidators: true,
        }
      );

      savedMatches.push(saved);
    }

    return savedMatches;
  } catch (err) {
    console.error("❌ fetchAndStoreMatches error:", err.message);
    return [];
  }
};

/* =====================================================
   🔥 REAL-TIME SCORE UPDATE (USING cricScore)
===================================================== */
export const getMatchDetails = async (matchId) => {
  const existingMatch = await CricketMatch.findById(matchId);
  if (!existingMatch) throw new Error("Match not found");

  const response = await fetch(`${BASE_URL}/cricScore?apikey=${API_KEY}`);
  const apiData = await response.json();

  if (apiData.status !== "success") {
    throw new Error("Live API fetch failed");
  }

  // 🔍 same match dhundo
  const liveMatch = apiData.data.find((m) => m.id === existingMatch.apiMatchId);

  if (!liveMatch) {
    throw new Error("Live match not found in cricScore");
  }

  return await CricketMatch.findByIdAndUpdate(
    matchId,
    {
      status: liveMatch.status,
      ms: liveMatch.ms,
      score: [
        {
          team: liveMatch.t1,
          runs: liveMatch.t1s || "",
        },
        {
          team: liveMatch.t2,
          runs: liveMatch.t2s || "",
        },
      ],
      lastUpdated: new Date(),
    },
    { new: true }
  );
};
