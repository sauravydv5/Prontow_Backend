import mongoose from "mongoose";

const cricketMatchSchema = new mongoose.Schema({
    apiMatchId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    matchType: { type: String, required: true },
    status: { type: String, required: true },
    venue: { type: String },
    date: { type: Date, required: true },
    dateTimeGMT: { type: Date },
    teams: [{ type: String }],
    score: [{
        r: Number,
        w: Number,
        o: Number,
        inning: String
    }],
    tossWinner: String,
    tossChoice: String,
    matchWinner: String,
    hasSquad: Boolean,
    lastUpdated: { type: Date, default: Date.now }
}, { timestamps: true });

export default mongoose.model("CricketMatch", cricketMatchSchema);
