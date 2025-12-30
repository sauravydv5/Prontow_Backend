import mongoose from "mongoose";

const betOrderSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    event: { type: mongoose.Schema.Types.ObjectId, ref: "BetEvent", required: true },

    type: { type: String, enum: ["BUY", "SELL"], required: true }, // BUY to enter, SELL to exit
    side: { type: String, enum: ["YES", "NO"], required: true }, // Which outcome

    price: { type: Number, required: true, min: 0, max: 100 },
    quantity: { type: Number, required: true, min: 1 },

    amountLocked: { type: Number, required: true }, // Total amount deducted from wallet

    remainingQuantity: { type: Number, required: true, default: function () { return this.quantity; } },
    triggerPrice: { type: Number }, // For Stop Loss or specific triggers

    status: {
        type: String,
        enum: ["PENDING", "MATCHED", "CANCELLED", "FAILED"],
        default: "PENDING"
    },

    matchedAt: { type: Date },
    cancelledAt: { type: Date }
}, { timestamps: true });

export default mongoose.model("BetOrder", betOrderSchema);
