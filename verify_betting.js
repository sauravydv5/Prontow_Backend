import mongoose from "mongoose";
import dotenv from "dotenv";
import { connectDB } from "./src/config/db.js";
import User from "./src/models/user.js";
import Wallet from "./src/models/wallet.js";
import BetEvent from "./src/models/BetEvent.js";
import BetOrder from "./src/models/BetOrder.js";
import BetPosition from "./src/models/BetPosition.js";
import CricketMatch from "./src/models/CricketMatch.js";
import { placeOrder, settleEvent } from "./src/services/tradingEngine.js";

dotenv.config();

const verifyBetting = async () => {
    try {
        await connectDB();
        console.log("Connected to DB");

        // 1. Create Test User
        const testEmail = `bettor_${Date.now()}@test.com`;
        let user = await User.create({
            firstName: "Test",
            lastName: "Bettor",
            email: testEmail,
            phoneNumber: `999${Date.now().toString().slice(-7)}`,
            password: "password123",
            gameTokens: 1000 // Start with 1000 tokens
        });
        console.log("User created:", user._id, "Tokens:", user.gameTokens);

        // 2. Create Mock Match & Event
        const match = await CricketMatch.create({
            apiMatchId: `test_match_${Date.now()}`,
            name: "IND vs AUS",
            matchType: "T20",
            status: "Live",
            date: new Date(),
            teams: ["India", "Australia"]
        });

        const event = await BetEvent.create({
            question: "India to win?",
            match: match._id,
            endTime: new Date(Date.now() + 3600000),
            yesPrice: 5.0,
            noPrice: 5.0,
            currentYesPrice: 5.0,
            currentNoPrice: 5.0,
            status: "OPEN"
        });
        console.log("Event created:", event._id);

        // 3. Place BUY YES Order
        console.log("Placing BUY YES order...");
        await placeOrder(user._id, event._id, "BUY", "YES", 5.0, 10); // Cost 50

        // Check Game Tokens
        user = await User.findById(user._id);
        console.log("Game tokens after buy (should be 950):", user.gameTokens);
        if (user.gameTokens !== 950) throw new Error("Token deduction failed");

        // Check Position
        const position = await BetPosition.findOne({ user: user._id, event: event._id, side: "YES" });
        console.log("Position created:", position.quantity, "shares @", position.averagePrice);
        if (position.quantity !== 10) throw new Error("Position creation failed");

        // 4. Settle Event (YES Wins)
        console.log("Settling event as YES...");
        await settleEvent(event._id, "YES");

        // Check Game Tokens (Should get 10 * 10 = 100 winnings + 950 remaining = 1050)
        user = await User.findById(user._id);
        console.log("Game tokens after settlement (should be 1050):", user.gameTokens);
        if (user.gameTokens !== 1050) throw new Error("Settlement credit failed");

        console.log("VERIFICATION SUCCESSFUL");

    } catch (error) {
        console.error("Verification Failed:", error);
    } finally {
        mongoose.connection.close();
    }
};

verifyBetting();
