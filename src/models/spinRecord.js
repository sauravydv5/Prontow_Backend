import mongoose from "mongoose";

const spinRecordSchema = new mongoose.Schema(
    {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        spinWheel: { type: mongoose.Schema.Types.ObjectId, ref: "SpinWheel", required: true },
        winningSection: {
            title: { type: String, required: true },
            type: { type: String, enum: ["cash", "token"], required: true },
            value: { type: Number, required: true },
            color: { type: String }
        },
        tokensUsed: { type: Number, required: true }
    },
    { timestamps: true }
);

export default mongoose.model("SpinRecord", spinRecordSchema);
