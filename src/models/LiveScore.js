import mongoose from "mongoose";

const liveScoreSchema = new mongoose.Schema({
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Event",
    unique: true,
  },
  teamA: {
    runs: Number,
    wickets: Number,
    overs: Number,
  },
  teamB: {
    runs: Number,
    wickets: Number,
    overs: Number,
  },
  status: {
    type: String,
    enum: ["UPCOMING", "LIVE", "COMPLETED"],
    default: "UPCOMING",
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.model("LiveScore", liveScoreSchema);
