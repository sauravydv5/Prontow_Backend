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
    // 🔥 FIX: PRICE MOVEMENT LOGIC ADDED
    // YES / NO price ko demand ke hisaab se move karna
    const IMPACT = 0.01;
    const delta = price * IMPACT;

    if (price >= event.currentYesPrice) {
      // YES demand ↑
      event.currentYesPrice = Math.min(event.currentYesPrice + delta, 10);
      event.currentNoPrice = 10 - event.currentYesPrice;
    } else {
      // NO demand ↑
      event.currentNoPrice = Math.min(event.currentNoPrice + delta, 10);
      event.currentYesPrice = 10 - event.currentNoPrice;
    }

    // Price history
    event.priceHistory.push({
      yesPrice: event.currentYesPrice,
      noPrice: event.currentNoPrice,
      tradedPrice: price,
      timestamp: new Date(),
    });

    await event.save();

    // Emit Event Update
    emitBetEventUpdate(event._id, {
      currentYesPrice: event.currentYesPrice,
      currentNoPrice: event.currentNoPrice,
      lastTradedPrice: price,
    });

    console.log(
      `[Trading] Price Updated for Event ${event._id}: YES ${event.currentYesPrice} | NO ${event.currentNoPrice}`
    );
  }
};

const executeTrade = async (
  session,
  takerOrder,
  makerOrder,
  price,
  quantity
) => {
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

  takerOrder.matchedAt = new Date();
  makerOrder.matchedAt = new Date();

  await takerOrder.save({ session });
  await makerOrder.save({ session });

  // Emit Order Updates
  emitBetOrderUpdate(takerOrder.user, takerOrder.toObject());
  emitBetOrderUpdate(makerOrder.user, makerOrder.toObject());

  console.log(
    `[Trading] Trade Executed: ${quantity} @ ${price}. Taker: ${takerOrder._id}, Maker: ${makerOrder._id}`
  );

  // BUYER UPDATE
  const buyerUser = await User.findById(buyerOrder.user).session(session);
  // Tokens already locked during order placement

  // SELLER UPDATE
  const sellerUser = await User.findById(sellerOrder.user).session(session);
  sellerUser.gameTokens += totalAmount;
  await sellerUser.save({ session });

  // BUYER POSITION
  let buyerPos = await BetPosition.findOne({
    user: buyerOrder.user,
    event: buyerOrder.event,
    side: buyerOrder.side,
  }).session(session);

  if (!buyerPos) {
    buyerPos = new BetPosition({
      user: buyerOrder.user,
      event: buyerOrder.event,
      side: buyerOrder.side,
    });
  }

  const buyerTotalValue =
    buyerPos.averagePrice * buyerPos.quantity + totalAmount;

  buyerPos.quantity += quantity;
  buyerPos.averagePrice = buyerTotalValue / buyerPos.quantity;
  buyerPos.investedAmount += totalAmount;
  await buyerPos.save({ session });

  // SELLER POSITION
  const sellerPos = await BetPosition.findOne({
    user: sellerOrder.user,
    event: sellerOrder.event,
    side: sellerOrder.side,
  }).session(session);

  if (!sellerPos) {
    throw new Error("Seller position not found (Data Integrity Error)");
  }

  sellerPos.quantity -= quantity;
  sellerPos.realizedProfit += totalAmount - sellerPos.averagePrice * quantity;
  await sellerPos.save({ session });

  // 🔥 FIX: EVENT PRICE UPDATE (MISSING EARLIER)
  const event = await BetEvent.findById(takerOrder.event).session(session);
  await updateEventPrice(event, price);
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
    remainingQuantity: { $gt: 0 },
  };

  if (order.type === "BUY") {
    matchQuery.price = { $lte: order.price };
  } else {
    matchQuery.price = { $gte: order.price };
  }

  const matchingOrders = await BetOrder.find(matchQuery)
    .sort({ price: sortDir, createdAt: 1 })
    .session(session);

  for (const matchOrder of matchingOrders) {
    if (order.remainingQuantity <= 0) break;

    const tradeQty = Math.min(
      order.remainingQuantity,
      matchOrder.remainingQuantity
    );

    await executeTrade(session, order, matchOrder, matchOrder.price, tradeQty);
  }
};

export const placeOrder = async (
  userId,
  eventId,
  type,
  side,
  price,
  quantity
) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const event = await BetEvent.findById(eventId).session(session);
    if (!event || event.status !== "OPEN") {
      throw new Error("Event not open for trading");
    }

    const user = await User.findById(userId).session(session);
    if (!user) throw new Error("User not found");
    if (user.role !== "customer")
      throw new Error("Only customers can place bets");

    if (quantity <= 0) throw new Error("Quantity must be greater than 0");
    if (price < 0 || price > 10)
      throw new Error("Price must be between 0 and 10");

    const totalCost = price * quantity;

    // BUY
    if (type === "BUY") {
      if (user.gameTokens < totalCost) {
        throw new Error("Insufficient game tokens");
      }
      user.gameTokens -= totalCost;
      await user.save({ session });
    } else {
      // SELL
      const position = await BetPosition.findOne({
        user: userId,
        event: eventId,
        side,
      }).session(session);

      if (!position || position.quantity < quantity) {
        throw new Error("Insufficient position to sell");
      }
    }

    const order = new BetOrder({
      user: userId,
      event: eventId,
      type,
      side,
      price,
      quantity,
      remainingQuantity: quantity,
      amountLocked: type === "BUY" ? totalCost : 0,
      status: "PENDING",
    });

    await order.save({ session });
    emitBetOrderUpdate(userId, order.toObject());

    await matchOrders(session, order);

    await session.commitTransaction();
    session.endSession();

    const finalOrder = await BetOrder.findById(order._id);
    return {
      success: true,
      orderId: finalOrder._id,
      status: finalOrder.status,
      filled: finalOrder.quantity - finalOrder.remainingQuantity,
      remainingTokens: user.gameTokens,
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
    event.result = result;
    event.settledAt = new Date();
    await event.save({ session });

    emitBetEventUpdate(eventId, {
      status: "SETTLED",
      result,
    });

    // Settle positions
    const positions = await BetPosition.find({
      event: eventId,
      quantity: { $gt: 0 },
    }).session(session);

    for (const pos of positions) {
      const winnings = pos.side === result ? pos.quantity * 10 : 0;

      if (winnings > 0) {
        const user = await User.findById(pos.user).session(session);
        user.gameTokens += winnings;
        await user.save({ session });
      }

      pos.realizedProfit += winnings - pos.averagePrice * pos.quantity;
    }

    // Cancel remaining PENDING orders
    await BetOrder.updateMany(
      { event: eventId, status: "PENDING" },
      { status: "CANCELLED", cancelledAt: new Date() }
    ).session(session);

    // Refund locked tokens for cancelled BUY orders
    const cancelledBuyOrders = await BetOrder.find({
      event: eventId,
      type: "BUY",
      status: "CANCELLED",
    }).session(session);

    for (const order of cancelledBuyOrders) {
      const refundAmount = order.price * order.remainingQuantity;
      const user = await User.findById(order.user).session(session);
      user.gameTokens += refundAmount;
      await user.save({ session });
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
