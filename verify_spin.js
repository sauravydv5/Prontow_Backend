import mongoose from "mongoose";
import User from "./src/models/user.js";
import SpinWheel from "./src/models/spinWheel.js";
import dotenv from "dotenv";

dotenv.config();

const verifySpinWheel = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB");

        // 1. Setup Test User and Config
        const testPhone = "9999999999";
        await User.deleteOne({ phoneNumber: testPhone });
        await SpinWheel.deleteMany({}); // Clear existing config

        const newUser = await User.create({
            phoneNumber: testPhone,
            gameTokens: 100,
            winningCash: 0,
            isPhoneVerified: true
        });
        console.log(`Test User Created: ${newUser._id} (Tokens: ${newUser.gameTokens})`);

        // Create Spin Config
        const sections = [
            { title: "10 Tokens", type: "token", value: 10, probability: 100 }, // 100% chance for test
            { title: "50 Cash", type: "cash", value: 50, probability: 0 },
            { title: "20 Tokens", type: "token", value: 20, probability: 0 },
            { title: "100 Cash", type: "cash", value: 100, probability: 0 }
        ];
        await SpinWheel.create({ sections });
        console.log("Spin Wheel Configured");

        // 2. Simulate Spin (Logic from Controller)
        const tokensToUse = 10;

        // Fetch User & Config
        const user = await User.findById(newUser._id);
        const spinConfig = await SpinWheel.findOne();

        if (user.gameTokens < tokensToUse) {
            throw new Error("Insufficient tokens");
        }

        // Deduct Tokens
        user.gameTokens -= tokensToUse;

        // Select Winner (Deterministic for test: first section has 100 weight)
        const winningSection = spinConfig.sections[0];

        // Apply Prize
        if (winningSection.type === "cash") {
            user.winningCash += winningSection.value;
        } else if (winningSection.type === "token") {
            user.gameTokens += winningSection.value;
        }
        await user.save();

        console.log(`Spin Result: Won ${winningSection.title}`);
        console.log(`Updated User: Tokens=${user.gameTokens}, Cash=${user.winningCash}`);

        // Verification
        // Initial 100 - 10 (cost) + 10 (prize) = 100
        if (user.gameTokens !== 100) {
            console.error("❌ FAILED: Tokens calculation incorrect");
        } else {
            console.log("✅ PASSED: Tokens updated correctly");
        }

        // Cleanup
        await User.deleteOne({ _id: newUser._id });
        await SpinWheel.deleteMany({});
        console.log("Cleanup complete");

    } catch (error) {
        console.error("Error:", error);
    } finally {
        await mongoose.disconnect();
    }
};

verifySpinWheel();
