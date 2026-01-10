import mongoose from "mongoose";

const teamSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    shortName: {
      type: String,
      trim: true,
    },
    countryCode: {
      type: String,
      uppercase: true,
    },
    flagUrl: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// 🔴 MOST IMPORTANT LINE
const Team = mongoose.model("Team", teamSchema);

// ✅ DEFAULT EXPORT
export default Team;
