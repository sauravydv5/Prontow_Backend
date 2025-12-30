import mongoose from "mongoose";

const betEventSchema = new mongoose.Schema({
    question: { type: String, required: true },
    match: { type: mongoose.Schema.Types.ObjectId, ref: "CricketMatch", required: true },
    category: { type: String, default: "CRICKET" },

    // Market Status
    status: {
        type: String,
        enum: ["OPEN", "CLOSED", "SETTLED", "CANCELLED"],
        default: "OPEN"
    },

    // Pricing
    yesPrice: { type: Number, default: 5.0, min: 0, max: 10 },
    noPrice: { type: Number, default: 5.0, min: 0, max: 10 },
    currentYesPrice: { type: Number, default: 5.0, min: 0, max: 10 },
    currentNoPrice: { type: Number, default: 5.0, min: 0, max: 10 },
    totalYesVolume: { type: Number, default: 0 },
    totalNoVolume: { type: Number, default: 0 },

    priceHistory: [{
        yesPrice: { type: Number },
        noPrice: { type: Number },
        timestamp: { type: Date, default: Date.now }
    }],

    // Settlement
    result: { type: String, enum: ["YES", "NO", "DRAW", null], default: null },
    settledAt: { type: Date },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" } // Admin
}, { timestamps: true });

export default mongoose.model("BetEvent", betEventSchema);
