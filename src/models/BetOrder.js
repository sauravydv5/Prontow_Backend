import mongoose from "mongoose";

const betOrderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BetEvent",
      required: true,
    },

    type: { type: String, enum: ["BUY", "SELL"], required: true },
    side: { type: String, enum: ["YES", "NO"], required: true },

    price: { type: Number, required: true, min: 0, max: 100 },
    quantity: { type: Number, required: true, min: 1 },

    amountLocked: { type: Number, required: true },

    remainingQuantity: {
      type: Number,
      required: true,
      default: function () {
        return this.quantity;
      },
    },

    triggerPrice: { type: Number },

    status: {
      type: String,
      enum: ["PENDING", "MATCHED", "CANCELLED", "FAILED"],
      default: "PENDING",
    },

    matchedAt: { type: Date },
    cancelledAt: { type: Date },
  },
  { timestamps: true }
);

/* 🔥 ADD ONLY THIS PART */
betOrderSchema.index({ event: 1 });
betOrderSchema.index({ event: 1, user: 1 });
betOrderSchema.index({ event: 1, status: 1 });
betOrderSchema.index({ user: 1 });

export default mongoose.model("BetOrder", betOrderSchema);
