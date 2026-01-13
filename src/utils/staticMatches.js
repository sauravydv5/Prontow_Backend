// src/data/staticMatches.js

const staticMatches = [
  {
    apiMatchId: "STATIC_MATCH_001",
    name: "India vs Australia",
    matchType: "odi",
    status: "Live",
    venue: "Wankhede Stadium, Mumbai",
    date: new Date("2026-01-13"),
    dateTimeGMT: new Date("2026-01-13T08:30:00Z"),
    score: [{ r: 245, w: 4, o: 38.2, inning: "India Innings" }],
    tossWinner: "India",
    tossChoice: "Bat",
    hasSquad: true,
  },
  {
    apiMatchId: "STATIC_MATCH_002",
    name: "England vs South Africa",
    matchType: "t20",
    status: "Upcoming",
    venue: "Lords, London",
    date: new Date("2026-01-14"),
    dateTimeGMT: new Date("2026-01-14T14:00:00Z"),
    hasSquad: true,
  },
  {
    apiMatchId: "STATIC_MATCH_003",
    name: "Pakistan vs New Zealand",
    matchType: "odi",
    status: "Upcoming",
    venue: "Gaddafi Stadium, Lahore",
    date: new Date("2026-01-15"),
    dateTimeGMT: new Date("2026-01-15T09:00:00Z"),
  },
  {
    apiMatchId: "STATIC_MATCH_004",
    name: "Sri Lanka vs Bangladesh",
    matchType: "t20",
    status: "Live",
    venue: "Colombo",
    date: new Date("2026-01-13"),
    dateTimeGMT: new Date("2026-01-13T12:00:00Z"),
    score: [{ r: 122, w: 3, o: 14.1, inning: "SL Innings" }],
  },

  // 🔁 Extra dummy matches (total 12)
  ...Array.from({ length: 8 }).map((_, i) => ({
    apiMatchId: `STATIC_MATCH_00${i + 5}`,
    name: `Team A vs Team B ${i + 5}`,
    matchType: i % 2 === 0 ? "t20" : "odi",
    status: i % 3 === 0 ? "Live" : "Upcoming",
    venue: "International Stadium",
    date: new Date(`2026-01-${16 + i}`),
    dateTimeGMT: new Date(`2026-01-${16 + i}T10:00:00Z`),
    hasSquad: true,
  })),
];

export default staticMatches;
