import mongoose from "mongoose";
import BetEvent from "../models/BetEvent.js";
import BetOrder from "../models/BetOrder.js";
import BetPosition from "../models/BetPosition.js";
import User from "../models/user.js";
import { emitBetOrderUpdate, emitBetEventUpdate } from "./socketService.js";

/* =====================================================
   🔁 PRICE UPDATE
===================================================== */
const updateEventPrice = async (event, price) => {
  if (!price) return;

  const IMPACT = 0.01;
  const delta = price * IMPACT;

  if (price >= event.currentYesPrice) {
    event.currentYesPrice = Math.min(event.currentYesPrice + delta, 10);
    event.currentNoPrice = 10 - event.currentYesPrice;
  } else {
    event.currentNoPrice = Math.min(event.currentNoPrice + delta, 10);
    event.currentYesPrice = 10 - event.currentNoPrice;
  }

  event.priceHistory.push({
    yesPrice: event.currentYesPrice,
    noPrice: event.currentNoPrice,
    tradedPrice: price,
    timestamp: new Date(),
  });

  await event.save();

  emitBetEventUpdate(event._id, {
    currentYesPrice: event.currentYesPrice,
    currentNoPrice: event.currentNoPrice,
    lastTradedPrice: price,
  });
};

/* =====================================================
   🔁 EXECUTE TRADE
===================================================== */
const executeTrade = async (
  session,
  takerOrder,
  makerOrder,
  price,
  quantity
) => {
  const totalAmount = price * quantity;

  const buyerOrder = takerOrder.type === "BUY" ? takerOrder : makerOrder;
  const sellerOrder = takerOrder.type === "SELL" ? takerOrder : makerOrder;

  takerOrder.remainingQuantity -= quantity;
  makerOrder.remainingQuantity -= quantity;

  if (takerOrder.remainingQuantity === 0) takerOrder.status = "MATCHED";
  if (makerOrder.remainingQuantity === 0) makerOrder.status = "MATCHED";

  takerOrder.matchedAt = new Date();
  makerOrder.matchedAt = new Date();

  await takerOrder.save({ session });
  await makerOrder.save({ session });

  emitBetOrderUpdate(takerOrder.user, takerOrder.toObject());
  emitBetOrderUpdate(makerOrder.user, makerOrder.toObject());

  // SELLER CREDIT
  const seller = await User.findById(sellerOrder.user).session(session);
  seller.gameTokens += totalAmount;
  await seller.save({ session });

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
      quantity: 0,
      investedAmount: 0,
      averagePrice: 0,
      realizedProfit: 0,
    });
  }

  buyerPos.investedAmount += totalAmount;
  buyerPos.quantity += quantity;
  buyerPos.averagePrice = buyerPos.investedAmount / buyerPos.quantity;
  await buyerPos.save({ session });

  // SELLER POSITION (short allowed)
  let sellerPos = await BetPosition.findOne({
    user: sellerOrder.user,
    event: sellerOrder.event,
    side: sellerOrder.side,
  }).session(session);

  if (!sellerPos) {
    sellerPos = new BetPosition({
      user: sellerOrder.user,
      event: sellerOrder.event,
      side: sellerOrder.side,
      quantity: 0,
      investedAmount: 0,
      averagePrice: 0,
      realizedProfit: 0,
    });
  }

  sellerPos.quantity -= quantity;
  sellerPos.realizedProfit += totalAmount;
  await sellerPos.save({ session });

  const event = await BetEvent.findById(buyerOrder.event).session(session);
  await updateEventPrice(event, price);
};

/* =====================================================
   🔁 MATCH ORDERS
===================================================== */
const matchOrders = async (session, order) => {
  const oppositeType = order.type === "BUY" ? "SELL" : "BUY";
  const sortDir = order.type === "BUY" ? 1 : -1;

  const query = {
    event: order.event,
    side: order.side,
    type: oppositeType,
    status: "PENDING",
    remainingQuantity: { $gt: 0 },

    // 🔥 IMPORTANT FIX
    user: { $ne: order.user }, // self-trade block
  };

  if (order.type === "BUY") {
    query.price = { $lte: order.price };
  } else {
    query.price = { $gte: order.price };
  }

  const matches = await BetOrder.find(query)
    .sort({ price: sortDir, createdAt: 1 })
    .session(session);

  for (const m of matches) {
    if (order.remainingQuantity <= 0) break;

    const qty = Math.min(order.remainingQuantity, m.remainingQuantity);
    await executeTrade(session, order, m, m.price, qty);
  }
};

/* =====================================================
   📝 PLACE ORDER  (Pending BUY SELL ENABLED)
===================================================== */
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
    if (!event || event.status !== "OPEN") throw new Error("Event not open");

    const user = await User.findById(userId).session(session);
    if (!user || user.role !== "customer") throw new Error("Invalid user");

    if (quantity <= 0) throw new Error("Invalid quantity");
    if (price < 0 || price > 10) throw new Error("Invalid price");

    const totalCost = price * quantity;

    // BUY
    if (type === "BUY") {
      if (user.gameTokens < totalCost) throw new Error("Insufficient balance");

      user.gameTokens -= totalCost;
      await user.save({ session });
    }

    // SELL (position + pending buy)
    if (type === "SELL") {
      const position = await BetPosition.findOne({
        user: userId,
        event: eventId,
        side,
      }).session(session);

      const pendingBuy = await BetOrder.aggregate([
        {
          $match: {
            user: new mongoose.Types.ObjectId(userId),
            event: new mongoose.Types.ObjectId(eventId),
            side,
            type: "BUY",
            status: "PENDING",
          },
        },
        { $group: { _id: null, qty: { $sum: "$remainingQuantity" } } },
      ]);

      const pendingSell = await BetOrder.aggregate([
        {
          $match: {
            user: new mongoose.Types.ObjectId(userId),
            event: new mongoose.Types.ObjectId(eventId),
            side,
            type: "SELL",
            status: "PENDING",
          },
        },
        { $group: { _id: null, qty: { $sum: "$remainingQuantity" } } },
      ]);

      const posQty = position?.quantity || 0;
      const buyQty = pendingBuy[0]?.qty || 0;
      const sellQty = pendingSell[0]?.qty || 0;

      const sellableQty = posQty + buyQty - sellQty;
      if (sellableQty < quantity)
        throw new Error("SELL quantity exceeds allowed limit");
    }

    const order = new BetOrder({
      user: userId,
      event: eventId,
      type,
      side,
      price,
      quantity,
      remainingQuantity: quantity,
      status: "PENDING",
      amountLocked: type === "BUY" ? totalCost : 0,
    });

    await order.save({ session });
    emitBetOrderUpdate(userId, order.toObject());

    await matchOrders(session, order);

    await session.commitTransaction();
    session.endSession();

    return {
      success: true,
      orderId: order._id,
      status: order.status,
      filled: order.quantity - order.remainingQuantity,
      remainingTokens: user.gameTokens,
    };
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
};

/* =====================================================
   🏁 SETTLE EVENT  ✅ (EXPORT FIX)
===================================================== */
export const settleEvent = async (eventId, result) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const event = await BetEvent.findById(eventId).session(session);
    if (!event || event.status === "SETTLED")
      throw new Error("Event already settled");

    event.status = "SETTLED";
    event.result = result;
    event.settledAt = new Date();
    await event.save({ session });

    emitBetEventUpdate(eventId, { status: "SETTLED", result });

    const positions = await BetPosition.find({
      event: eventId,
      quantity: { $ne: 0 },
    }).session(session);

    for (const pos of positions) {
      const payout = pos.side === result ? pos.quantity * 10 : 0;

      if (payout > 0) {
        const user = await User.findById(pos.user).session(session);
        user.gameTokens += payout;
        await user.save({ session });
      }

      pos.realizedProfit += payout - pos.averagePrice * pos.quantity;
      pos.quantity = 0;
      await pos.save({ session });
    }

    await BetOrder.updateMany(
      { event: eventId, status: "PENDING" },
      { status: "CANCELLED", cancelledAt: new Date() }
    ).session(session);

    await session.commitTransaction();
    session.endSession();

    return { success: true };
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
};
