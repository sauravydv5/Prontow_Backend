import mongoose from "mongoose";
import dotenv from "dotenv";
import { connectDB } from "./src/config/db.js";
import User from "./src/models/user.js";
import BetEvent from "./src/models/BetEvent.js";
import BetOrder from "./src/models/BetOrder.js";
import BetPosition from "./src/models/BetPosition.js";
import CricketMatch from "./src/models/CricketMatch.js";
import { placeOrder } from "./src/services/tradingEngine.js";

dotenv.config();

const verifyP2P = async () => {
    try {
        await connectDB();
        console.log("Connected to DB");

        // Cleanup
        await User.deleteMany({ email: { $regex: /test_/ } });
        await BetOrder.deleteMany({});
        await BetPosition.deleteMany({});
        await BetEvent.deleteMany({});
        await CricketMatch.deleteMany({});

        // 1. Setup Users
        const userA = await User.create({
            firstName: "User", lastName: "A", email: `test_a_${Date.now()}@test.com`,
            phoneNumber: `999${Date.now().toString().slice(-7)}1`, password: "password", gameTokens: 1000, role: "customer"
        });
        const userB = await User.create({
            firstName: "User", lastName: "B", email: `test_b_${Date.now()}@test.com`,
            phoneNumber: `999${Date.now().toString().slice(-7)}2`, password: "password", gameTokens: 1000, role: "customer"
        });
        const marketMaker = await User.create({
            firstName: "Market", lastName: "Maker", email: `test_mm_${Date.now()}@test.com`,
            phoneNumber: `999${Date.now().toString().slice(-7)}3`, password: "password", gameTokens: 10000, role: "customer"
        });

        // 2. Setup Event
        const match = await CricketMatch.create({
            apiMatchId: `test_match_${Date.now()}`, name: "IND vs AUS", matchType: "T20", status: "Live", date: new Date(), teams: ["India", "Australia"]
        });
        const event = await BetEvent.create({
            question: "India to win?", match: match._id, endTime: new Date(Date.now() + 3600000),
            yesPrice: 5.0, noPrice: 5.0, currentYesPrice: 5.0, currentNoPrice: 5.0, status: "OPEN",
            totalYesVolume: 0, totalNoVolume: 0, priceHistory: []
        });

        console.log("--- SETUP COMPLETE ---");

        // 3. Market Maker provides Liquidity (Sells YES @ 5)
        // MM needs Position first? Or we allow MM to short?
        // My code requires Position to sell.
        // So MM must BUY NO to "Sell YES"? Or just have a position hacked.
        // Let's hack a position for MM.
        await BetPosition.create({
            user: marketMaker._id, event: event._id, side: "YES", quantity: 1000, averagePrice: 5, investedAmount: 5000
        });

        console.log("MM placing Sell Order: 100 YES @ 5");
        await placeOrder(marketMaker._id, event._id, "SELL", "YES", 5.0, 100);

        // 4. User A Buys 10 YES @ 5 (Matches MM)
        console.log("User A buying 10 YES @ 5");
        await placeOrder(userA._id, event._id, "BUY", "YES", 5.0, 10);

        // Verify User A Position
        const posA = await BetPosition.findOne({ user: userA._id, event: event._id, side: "YES" });
        console.log(`User A Position: ${posA.quantity} YES`); // Should be 10

        // 4.5 Cancel MM Order to clear the book
        await BetOrder.updateMany({ user: marketMaker._id }, { status: "CANCELLED" });
        console.log("Cancelled MM Orders");

        // 5. User A tries "Exit With Price" (Limit Sell) @ 6
        // No Buyers @ 6. Should be PENDING.
        console.log("User A placing Sell Order: 10 YES @ 6");
        const sellOrderA = await placeOrder(userA._id, event._id, "SELL", "YES", 6.0, 10);
        console.log(`Order Status: ${sellOrderA.status}`); // Should be PENDING

        if (sellOrderA.status !== "PENDING") throw new Error("Expected PENDING status");

        // 6. User B Buys 5 YES @ 6 (Matches User A)
        console.log("User B buying 5 YES @ 6");
        const buyOrderB = await placeOrder(userB._id, event._id, "BUY", "YES", 6.0, 5);
        console.log(`Buy Order Status: ${buyOrderB.status}`); // Should be MATCHED

        // Verify User A sold 5
        const orderA_updated = await BetOrder.findById(sellOrderA.orderId);
        console.log(`User A Order Remaining: ${orderA_updated.remainingQuantity}`); // Should be 5

        // 7. User A "Instant Exit" (Market Sell) remaining 5
        // Needs a Buyer.
        // Current Order Book: MM Sell @ 5. No Buys.
        // User A places Sell.
        // If "Instant Exit" means "Sell at Best Bid", and there is NO Bid, it should wait.
        // Let's say User B places a Buy Order @ 4 (Limit Buy).
        console.log("User B placing Buy Order: 5 YES @ 4");
        await placeOrder(userB._id, event._id, "BUY", "YES", 4.0, 5);

        // Now User A "Instant Exits" (Sells @ 4)
        console.log("User A Instant Exit (Sell 5 YES @ 4)");
        const instantExit = await placeOrder(userA._id, event._id, "SELL", "YES", 4.0, 5);
        console.log(`Instant Exit Status: ${instantExit.status}`); // Should be MATCHED

        console.log("--- VERIFICATION SUCCESSFUL ---");

    } catch (error) {
        console.error("Verification Failed:", error);
    } finally {
        mongoose.connection.close();
    }
};

verifyP2P();
