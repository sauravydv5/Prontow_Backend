import mongoose from "mongoose";

const sectionSchema = new mongoose.Schema({
    title: { type: String, required: true },
    type: { type: String, enum: ["cash", "token"], required: true },
    value: { type: Number, required: true }, // Amount of cash or tokens
    color: { type: String, default: "#000000" },
    probability: { type: Number, default: 0 } // Weight for random selection
});

const spinWheelSchema = new mongoose.Schema(
    {
        name: { type: String, required: true },
        description: { type: String },
        sections: {
            type: [sectionSchema],
            validate: [arrayLimit, "{PATH} must have between 4 and 8 sections"]
        },
        isActive: { type: Boolean, default: true }
    },
    { timestamps: true }
);

function arrayLimit(val) {
    return val.length >= 4 && val.length <= 8;
}

export default mongoose.model("SpinWheel", spinWheelSchema);
