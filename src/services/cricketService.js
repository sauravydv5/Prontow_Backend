import CricketMatch from "../models/CricketMatch.js";

const API_KEY = "381e1578-0453-4fe2-880d-d7dd99303dc4";
const BASE_URL = "https://api.cricapi.com/v1";

export const fetchAndStoreMatches = async () => {
    try {
        const response = await fetch(`${BASE_URL}/currentMatches?apikey=${API_KEY}&offset=0`);
        const data = await response.json();

        if (data.status !== "success") {
            console.error("Failed to fetch matches:", data);
            return;
        }

        const matches = data.data;
        console.log(`Fetched ${matches.length} matches.`);

        for (const match of matches) {
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
                    lastUpdated: new Date()
                },
                { upsert: true, new: true }
            );
        }
        console.log("Matches updated in DB.");
    } catch (error) {
        console.error("Error in fetchAndStoreMatches:", error);
    }
};

// Function to get specific match details (for real-time updates)
export const getMatchDetails = async (matchId) => {
    // In a real scenario, we might want to fetch fresh data for a specific match
    // For now, we rely on the bulk fetch or existing DB data
    return await CricketMatch.findById(matchId);
};
