import mongoose from "mongoose";

const cricketMatchSchema = new mongoose.Schema(
  {
    apiMatchId: { type: String, required: true, unique: true },

    name: { type: String, required: true },
    matchType: { type: String },
    status: { type: String },

    venue: { type: String },

    date: { type: Date },
    dateTimeGMT: { type: Date },

    teamA: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      required: false,
    },
    teamB: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      required: false,
    },

    score: [
      {
        r: Number,
        w: Number,
        o: Number,
        inning: String,
      },
    ],

    tossWinner: String,
    tossChoice: String,
    matchWinner: String,
    hasSquad: Boolean,

    lastUpdated: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.model("CricketMatch", cricketMatchSchema);
