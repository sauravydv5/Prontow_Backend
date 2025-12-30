import mongoose from "mongoose";

const betPositionSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    event: { type: mongoose.Schema.Types.ObjectId, ref: "BetEvent", required: true },

    side: { type: String, enum: ["YES", "NO"], required: true },

    quantity: { type: Number, default: 0 },
    averagePrice: { type: Number, default: 0 },
    investedAmount: { type: Number, default: 0 }, // Total money put in

    // For P/L tracking
    realizedProfit: { type: Number, default: 0 }

}, { timestamps: true });

// Ensure unique position per user per event per side
betPositionSchema.index({ user: 1, event: 1, side: 1 }, { unique: true });

export default mongoose.model("BetPosition", betPositionSchema);
