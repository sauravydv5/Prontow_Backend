import mongoose from "mongoose";

const cricketMatchSchema = new mongoose.Schema(
  {
    apiMatchId: { type: String, required: true, unique: true },

    name: String,
    matchType: String,
    status: String,
    series: String,

    dateTimeGMT: Date,

    teamAName: String,
    teamBName: String,

    teamAScore: String,
    teamBScore: String,

    teamAImg: String,
    teamBImg: String,

    isLive: { type: Boolean, default: false },
    isUpcoming: { type: Boolean, default: false },

    lastUpdated: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.model("CricketMatch", cricketMatchSchema);
