import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    firstName: { type: String, default: "" },
    lastName: { type: String, default: "" },
    profilePic: { type: String, default: "" },
    dateofBirth: { type: Date, default: null },
    email: { type: String, unique: true, sparse: true }, // sparse allows multiple docs with no email
    phoneNumber: { type: String, unique: true, required: true },
    password: { type: String, default: "" },
    otp: { type: Number, default: null },
    otpExpiresAt: { type: Date, default: null },
    resetPasswordToken: { type: String, default: null },
    resetPasswordExpiresAt: { type: Date, default: null },
    role: { type: String, enum: ["customer", "admin"], default: "customer" },
    isPhoneVerified: { type: Boolean, default: false },
    isEmailVerified: { type: Boolean, default: false },
    isNew: { type: Boolean, default: true },
    isBlocked: { type: Boolean, default: false },
    lastLogin: { type: Date },
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    gameTokens: { type: Number, default: 100 },
    winningCash: { type: Number, default: 0 },

    addresses: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Address"
      }
    ],
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);
export default User;
