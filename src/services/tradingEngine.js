import mongoose from "mongoose";
import BetEvent from "../models/BetEvent.js";
import BetOrder from "../models/BetOrder.js";
import BetPosition from "../models/BetPosition.js";
import Wallet from "../models/wallet.js";
import User from "../models/user.js";
import { emitBetOrderUpdate, emitBetEventUpdate } from "./socketService.js";

// Helper to update price history (Last Traded Price)
const updateEventPrice = async (event, price) => {
    if (price) {
        // Update both prices to reflect the last trade? 
        // In P2P, YES price and NO price are decoupled, but usually P_YES + P_NO = 10.
        // For now, we just track the traded price for the side traded.
        // If YES traded at 6, NO implies 4.
        // But we might have separate books.
        // Let's just push to history.
        event.priceHistory.push({
            yesPrice: event.currentYesPrice, // Keep existing fields for now
            noPrice: event.currentNoPrice,
            timestamp: new Date()
        });
        await event.save();

        // Emit Event Update
        emitBetEventUpdate(event._id, {
            currentYesPrice: event.currentYesPrice,
            currentNoPrice: event.currentNoPrice,
            lastTradedPrice: price
        });
        console.log(`[Trading] Price Updated for Event ${event._id}: YES ${event.currentYesPrice} | NO ${event.currentNoPrice}`);
    }
};

const executeTrade = async (session, takerOrder, makerOrder, price, quantity) => {
    // 1. Calculate Amounts
    const totalAmount = price * quantity;

    // 2. Identify Buyer and Seller
    let buyerOrder, sellerOrder;
    if (takerOrder.type === "BUY") {
        buyerOrder = takerOrder;
        sellerOrder = makerOrder;
    } else {
        buyerOrder = makerOrder;
        sellerOrder = takerOrder;
    }

    // 3. Update Orders
    takerOrder.remainingQuantity -= quantity;
    makerOrder.remainingQuantity -= quantity;

    if (takerOrder.remainingQuantity === 0) takerOrder.status = "MATCHED";
    if (makerOrder.remainingQuantity === 0) makerOrder.status = "MATCHED";

    // Update matchedAt if fully matched? Or just last matched.
    takerOrder.matchedAt = new Date();
    makerOrder.matchedAt = new Date();

    await takerOrder.save({ session });
    await makerOrder.save({ session });

    // Emit Order Updates
    emitBetOrderUpdate(takerOrder.user, takerOrder.toObject());
    emitBetOrderUpdate(makerOrder.user, makerOrder.toObject());
    console.log(`[Trading] Trade Executed: ${quantity} @ ${price}. Taker: ${takerOrder._id}, Maker: ${makerOrder._id}`);

    // 4. Update Positions & Wallets

    // BUYER: Already locked tokens when order was placed (if taker) or will lock now?
    // Wait, Maker (Pending Order) already has tokens locked.
    // Taker (Market Order) needs to have tokens locked/checked.

    // Logic:
    // Seller gets Tokens.
    // Buyer gets Position.

    // Transfer Tokens: Buyer -> Seller
    // Note: Buyer's tokens were locked in the Order (amountLocked).
    // We need to deduct from Buyer's "Locked" and add to Seller's "Available".

    // BUYER UPDATE
    const buyerUser = await User.findById(buyerOrder.user).session(session);
    // If buyer was Maker, tokens were already deducted from gameTokens?
    // Let's check placeOrder logic. 
    // Yes, we deduct gameTokens upfront.
    // So we don't need to deduct again.

    // SELLER UPDATE
    const sellerUser = await User.findById(sellerOrder.user).session(session);
    sellerUser.gameTokens += totalAmount;
    await sellerUser.save({ session });

    // POSITION UPDATES
    // Buyer Position
    let buyerPos = await BetPosition.findOne({ user: buyerOrder.user, event: buyerOrder.event, side: buyerOrder.side }).session(session);
    if (!buyerPos) {
        buyerPos = new BetPosition({ user: buyerOrder.user, event: buyerOrder.event, side: buyerOrder.side });
    }
    // Avg Price Calculation
    const buyerTotalValue = (buyerPos.averagePrice * buyerPos.quantity) + totalAmount;
    buyerPos.quantity += quantity;
    buyerPos.averagePrice = buyerTotalValue / buyerPos.quantity;
    buyerPos.investedAmount += totalAmount;
    await buyerPos.save({ session });

    // Seller Position
    let sellerPos = await BetPosition.findOne({ user: sellerOrder.user, event: sellerOrder.event, side: sellerOrder.side }).session(session);
    if (!sellerPos) {
        throw new Error("Seller position not found (Data Integrity Error)");
    }
    sellerPos.quantity -= quantity;
    sellerPos.realizedProfit += (totalAmount - (sellerPos.averagePrice * quantity));
    await sellerPos.save({ session });

    // 5. Update Event Price (LTP)
    // We can update the event object directly here if needed
};

const matchOrders = async (session, order) => {
    const matchType = order.type === "BUY" ? "SELL" : "BUY";
    const matchSide = order.side;

    // Sort: Buy -> Lowest Sell Price first. Sell -> Highest Buy Price first.
    const sortDir = order.type === "BUY" ? 1 : -1;

    const matchQuery = {
        event: order.event,
        type: matchType,
        side: matchSide,
        status: "PENDING",
        remainingQuantity: { $gt: 0 }
    };

    if (order.type === "BUY") {
        // Buyer wants to buy at order.price or lower
        // Matches Sells where price <= order.price
        // For Market Buy (Instant), price might be 10 (Max)
        matchQuery.price = { $lte: order.price };
    } else {
        // Seller wants to sell at order.price or higher
        // Matches Buys where price >= order.price
        // For Market Sell (Instant), price might be 0 (Min)
        matchQuery.price = { $gte: order.price };
    }

    const matchingOrders = await BetOrder.find(matchQuery)
        .sort({ price: sortDir, createdAt: 1 }) // Price priority, then time priority
        .session(session);

    for (const matchOrder of matchingOrders) {
        if (order.remainingQuantity <= 0) break;

        const tradePrice = matchOrder.price; // Maker's price determines execution price
        const tradeQty = Math.min(order.remainingQuantity, matchOrder.remainingQuantity);

        await executeTrade(session, order, matchOrder, tradePrice, tradeQty);
    }
};

export const placeOrder = async (userId, eventId, type, side, price, quantity) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const event = await BetEvent.findById(eventId).session(session);
        if (!event || event.status !== "OPEN") {
            throw new Error("Event not open for trading");
        }

        const user = await User.findById(userId).session(session);
        if (!user) throw new Error("User not found");
        if (user.role !== "customer") throw new Error("Only customers can place bets");

        // Validate Inputs
        if (quantity <= 0) throw new Error("Quantity must be greater than 0");
        if (price < 0 || price > 10) throw new Error("Price must be between 0 and 10");

        const totalCost = price * quantity;

        // 1. Check Balances / Positions
        if (type === "BUY") {
            if (user.gameTokens < totalCost) {
                throw new Error(`Insufficient game tokens. Required: ${totalCost}, Available: ${user.gameTokens}`);
            }
            // Lock Tokens
            user.gameTokens -= totalCost;
            await user.save({ session });
        } else {
            // SELL
            const position = await BetPosition.findOne({ user: userId, event: eventId, side }).session(session);
            if (!position || position.quantity < quantity) {
                throw new Error("Insufficient position to sell");
            }
            // We don't credit tokens yet. We wait for match.
        }

        // 2. Create Order
        const order = new BetOrder({
            user: userId,
            event: eventId,
            type,
            side,
            price,
            quantity,
            remainingQuantity: quantity,
            amountLocked: type === "BUY" ? totalCost : 0,
            status: "PENDING"
        });
        await order.save({ session });

        // Emit Order Created
        emitBetOrderUpdate(userId, order.toObject());
        console.log(`[Trading] Order Placed: ${type} ${side} ${quantity} @ ${price}. ID: ${order._id}`);

        // 3. Attempt Match
        await matchOrders(session, order);

        await session.commitTransaction();
        session.endSession();

        // Refetch order to check status
        const finalOrder = await BetOrder.findById(order._id);
        return {
            success: true,
            orderId: finalOrder._id,
            status: finalOrder.status,
            filled: finalOrder.quantity - finalOrder.remainingQuantity,
            remainingTokens: user.gameTokens
        };

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        throw error;
    }
};

export const settleEvent = async (eventId, result) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const event = await BetEvent.findById(eventId).session(session);
        if (!event || event.status === "SETTLED") {
            throw new Error("Event already settled or not found");
        }

        event.status = "SETTLED";
        event.result = result; // "YES" or "NO"
        event.settledAt = new Date();
        await event.save({ session });

        // Emit Event Settled
        emitBetEventUpdate(eventId, {
            status: "SETTLED",
            result: result
        });

        // Find all positions
        const positions = await BetPosition.find({ event: eventId, quantity: { $gt: 0 } }).session(session);

        for (const pos of positions) {
            let winnings = 0;
            if (pos.side === result) {
                // Winner gets 10 per qty
                winnings = pos.quantity * 10;
            } else {
                // Loser gets 0
                winnings = 0;
            }

            if (winnings > 0) {
                const user = await User.findById(pos.user).session(session);
                if (user) {
                    user.gameTokens += winnings;
                    await user.save({ session });
                }
            }

            // Update position to reflect settlement
            pos.realizedProfit += (winnings - (pos.averagePrice * pos.quantity));
            // Reset quantity? Or keep for record?
            // Usually we might want to archive them. For now, we leave them.
        }

        // Also Cancel all PENDING orders?
        await BetOrder.updateMany(
            { event: eventId, status: "PENDING" },
            { status: "CANCELLED", cancelledAt: new Date() }
        ).session(session);

        // Refund locked tokens for Cancelled BUY orders
        const cancelledBuyOrders = await BetOrder.find({ event: eventId, type: "BUY", status: "CANCELLED" }).session(session);
        for (const order of cancelledBuyOrders) {
            // Refund remaining amount (price * remainingQuantity)
            // Note: amountLocked was totalCost. We should refund proportional to remaining.
            const refundAmount = order.price * order.remainingQuantity;
            const user = await User.findById(order.user).session(session);
            if (user) {
                user.gameTokens += refundAmount;
                await user.save({ session });
            }
        }

        await session.commitTransaction();
        session.endSession();
        return { success: true, settledCount: positions.length };

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        throw error;
    }
};
