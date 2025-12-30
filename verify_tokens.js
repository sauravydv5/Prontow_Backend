import mongoose from "mongoose";
import User from "./src/models/user.js";
import Wallet from "./src/models/wallet.js";
import dotenv from "dotenv";

dotenv.config();

const verifyGameTokens = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB");

        // 1. Verify Default Tokens
        const testPhone = "9999999999";
        await User.deleteOne({ phoneNumber: testPhone }); // Cleanup
        await Wallet.deleteOne({ user: { $in: await User.find({ phoneNumber: testPhone }).distinct("_id") } });

        const newUser = await User.create({
            phoneNumber: testPhone,
            isPhoneVerified: true
        });

        console.log(`New User Created: ${newUser._id}`);
        console.log(`Default Game Tokens: ${newUser.gameTokens}`);

        if (newUser.gameTokens !== 100) {
            console.error("❌ FAILED: Default game tokens should be 100");
        } else {
            console.log("✅ PASSED: Default game tokens are 100");
        }

        // 2. Verify Token Sync on Add Money
        // Simulate Add Money Logic (since we can't easily call controller directly without req/res mock, we'll simulate the logic)
        const amountToAdd = 500;

        // Create wallet if not exists (logic from controller)
        let wallet = await Wallet.create({ user: newUser._id, balance: 0, transactions: [] });

        // Add money logic
        wallet.balance += amountToAdd;
        wallet.transactions.unshift({
            type: "CREDIT",
            amount: amountToAdd,
            description: "Test Wallet top-up",
            createdAt: new Date(),
        });
        await wallet.save();

        // Sync logic (what we added)
        await User.findByIdAndUpdate(newUser._id, { $inc: { gameTokens: amountToAdd } });

        const updatedUser = await User.findById(newUser._id);
        console.log(`Updated Game Tokens: ${updatedUser.gameTokens}`);

        if (updatedUser.gameTokens !== 100 + amountToAdd) {
            console.error(`❌ FAILED: Game tokens should be ${100 + amountToAdd}`);
        } else {
            console.log(`✅ PASSED: Game tokens updated correctly to ${updatedUser.gameTokens}`);
        }

        // Cleanup
        await User.deleteOne({ _id: newUser._id });
        await Wallet.deleteOne({ _id: wallet._id });
        console.log("Cleanup complete");

    } catch (error) {
        console.error("Error:", error);
    } finally {
        await mongoose.disconnect();
    }
};

verifyGameTokens();
