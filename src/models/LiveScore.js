// models/LiveScore.js
import mongoose from "mongoose";

const liveScoreSchema = new mongoose.Schema(
  {
    matchId: { type: String, unique: true },
    team1: String,
    team2: String,
    team1Score: String,
    team2Score: String,
    status: String, // fixture | live | result
    statusText: String, // "Match starts at..."
    series: String,
    lastUpdated: Date,
  },
  { timestamps: true }
);

export default mongoose.model("LiveScore", liveScoreSchema);
