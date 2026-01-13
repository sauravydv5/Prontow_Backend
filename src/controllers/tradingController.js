import BetEvent from "../models/BetEvent.js";
import BetPosition from "../models/BetPosition.js";
import CricketMatch from "../models/CricketMatch.js";
import BetOrder from "../models/BetOrder.js";
import LiveScore from "../models/LiveScore.js";
import Team from "../models/Team.js";
import {
  placeOrder as placeOrderEngine,
  settleEvent as settleEventEngine,
} from "../services/tradingEngine.js";
import responseHandler from "../utils/responseHandler.js";

export const settleEventUser = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { result } = req.body; // "YES" or "NO"

    if (!["YES", "NO"].includes(result)) {
      return res
        .status(400)
        .json({ message: "Invalid result. Must be YES or NO" });
    }

    const outcome = await settleEventEngine(eventId, result);
    res
      .status(200)
      .json(responseHandler.success(outcome, "Event settled successfully"));
  } catch (error) {
    res.status(500).json(responseHandler.error(error.message));
  }
};

export const getEvents = async (req, res) => {
  try {
    const { sort } = req.query;

    // 🔁 SORT LOGIC (filter)
    let sortOptions = {};
    if (sort === "recently_added") {
      sortOptions = { createdAt: -1 };
    } else if (sort === "best_price") {
      sortOptions = { currentYesPrice: 1 };
    } else if (sort === "trending" || sort === "relevance") {
      sortOptions = {
        totalTrades: -1, // 🔥 traders ke basis pe trending
        updatedAt: -1,
      };
    } else {
      sortOptions = { createdAt: -1 };
    }

    // 🔥 AGGREGATION (always calculate trades)
    const events = await BetEvent.aggregate([
      { $match: { status: "OPEN" } },

      {
        $lookup: {
          from: "betorders",
          localField: "_id",
          foreignField: "event",
          as: "orders",
        },
      },

      {
        $addFields: {
          totalTrades: {
            $size: {
              $filter: {
                input: "$orders",
                as: "o",
                cond: {
                  $in: ["$$o.status", ["PENDING", "MATCHED"]],
                },
              },
            },
          },
          totalTraders: {
            $size: {
              $setUnion: [
                {
                  $map: {
                    input: {
                      $filter: {
                        input: "$orders",
                        as: "o",
                        cond: {
                          $in: ["$$o.status", ["PENDING", "MATCHED"]],
                        },
                      },
                    },
                    as: "o",
                    in: "$$o.user",
                  },
                },
              ],
            },
          },
        },
      },

      { $project: { orders: 0 } },

      // 🎯 SORT APPLY HOTA HAI YAHA
      { $sort: sortOptions },
    ]);

    res.status(200).json({
      status: true,
      data: events,
      message: "Events with trade count",
    });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};

export const placeOrder = async (req, res) => {
  try {
    const { eventId, type, side, price, quantity } = req.body;
    const userId = req.user._id;

    const result = await placeOrderEngine(
      userId,
      eventId,
      type,
      side,
      price,
      quantity
    );
    res
      .status(200)
      .json(responseHandler.success(result, "Order placed successfully"));
  } catch (error) {
    res.status(400).json(responseHandler.error(error.message));
  }
};

export const getPortfolio = async (req, res) => {
  try {
    const userId = req.user._id;

    /* ---------------- ORDERS (Unmatched / Pending) ---------------- */
    const orders = await BetOrder.find({
      user: userId,
      status: "PENDING",
      remainingQuantity: { $gt: 0 },
    }).populate("event");

    const orderTrades = orders.map((order) => ({
      _id: order._id,
      type: "ORDER",
      eventId: order.event?._id,
      question: order.event?.question || order.event?.title,
      matchName: "Pending Order",
      investment: 0,
      gain: 0,
      status: "Unmatched",
      quantity: order.remainingQuantity,
      side: order.side,
      canExit: true,
    }));

    /* ---------------- POSITIONS (Matched / Live) ---------------- */
    const positions = await BetPosition.find({
      user: userId,
      quantity: { $gt: 0 },
    }).populate("event");

    const positionTrades = positions.map((pos) => ({
      _id: pos._id,
      type: "POSITION",
      eventId: pos.event?._id,
      question: pos.event?.question || pos.event?.title,
      matchName: pos.event?.title || "Live Event",
      investment: pos.price * pos.quantity,
      gain: 0, // live P&L yaha calculate hoga
      status: "Matched",
      quantity: pos.quantity,
      side: pos.side,
      canExit: pos.event?.status !== "SETTLED",
    }));

    /* ---------------- SUMMARY ---------------- */
    const totalInvestment = positionTrades.reduce(
      (sum, t) => sum + t.investment,
      0
    );

    const portfolio = {
      summary: {
        investment: totalInvestment,
        liveGains: 0,
      },
      trades: [...orderTrades, ...positionTrades],
    };

    return res
      .status(200)
      .json(
        responseHandler.success(portfolio, "Portfolio retrieved successfully")
      );
  } catch (error) {
    console.error("Portfolio Error:", error);
    return res
      .status(500)
      .json(responseHandler.error("Failed to fetch portfolio"));
  }
};
// export const getHistory = async (req, res) => {
//   try {
//     const userId = req.user._id;
//     // Fetch positions where the event is settled OR quantity is 0 (if we handled exits that way)
//     // Better: Fetch all positions and let frontend filter, or filter by event status.
//     // Since BetPosition doesn't store event status directly, we populate and filter.

//     const positions = await BetPosition.find({ user: userId }).populate(
//       "event"
//     );

//     const history = positions.filter((pos) => pos.event.status === "SETTLED");

//     res
//       .status(200)
//       .json(responseHandler.success(history, "History retrieved successfully"));
//   } catch (error) {
//     res.status(500).json(responseHandler.error(error.message));
//   }
// };

export const getHistory = async (req, res) => {
  try {
    const userId = req.user._id;

    const positions = await BetPosition.find({ user: userId })
      .populate({
        path: "event",
        select: "name status startTime endTime",
      })
      .sort({ createdAt: -1 })
      .lean();

    // 🧠 Normalize + null safety
    const history = positions.map((pos) => {
      const event = pos.event || {};

      const positionStatus =
        pos.type === "SELL" || pos.quantity === 0 ? "SOLD" : "OPEN";

      return {
        ...pos,
        event: event,
        // eventStatus: event.status || "UNKNOWN",
        positionStatus,
      };
    });

    res
      .status(200)
      .json(
        responseHandler.success(
          history,
          "All events history retrieved successfully"
        )
      );
  } catch (error) {
    res.status(500).json(responseHandler.error(error.message));
  }
};

export const getMatchesUser = async (req, res) => {
  try {
    const { filter } = req.query;
    const now = new Date();

    let query = {};

    if (filter === "live") {
      query = {
        dateTimeGMT: { $lte: now },
        status: { $not: /completed|finished/i },
      };
    }

    if (filter === "upcoming") {
      query = {
        dateTimeGMT: { $gt: now },
      };
    }

    if (filter === "completed") {
      query = {
        status: { $regex: /completed|finished/i },
      };
    }

    const matches = await CricketMatch.find(query)
      .populate("teamA teamB")
      .sort({ dateTimeGMT: 1 });

    return res.status(200).json({
      status: true,
      data: matches,
      message: "Matches retrieved successfully",
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

export const getEventsByMatch = async (req, res) => {
  try {
    const { matchId } = req.params;
    const events = await BetEvent.find({ match: matchId }).populate("match");
    res
      .status(200)
      .json(responseHandler.success(events, "Events retrieved successfully"));
  } catch (error) {
    res.status(500).json(responseHandler.error(error.message));
  }
};

//get event detail controller
export const getEventDetails = async (req, res) => {
  try {
    const { eventId } = req.params;

    const event = await BetEvent.findById(eventId).populate("match");

    if (!event) {
      return res.status(404).json(responseHandler.error("Event not found"));
    }

    res
      .status(200)
      .json(
        responseHandler.success(event, "Event details retrieved successfully")
      );
  } catch (error) {
    res.status(500).json(responseHandler.error(error.message));
  }
};

// Order Book
export const getOrderBook = async (req, res) => {
  try {
    const { eventId } = req.params;

    // 1️⃣ Pending orders only
    const orders = await BetOrder.find({
      event: eventId,
      status: "PENDING",
      remainingQuantity: { $gt: 0 },
    }).sort({ price: -1, createdAt: 1 });

    // 2️⃣ Required response structure
    const orderBook = {
      yes: [],
      no: [],
    };

    // 3️⃣ Aggregate price-wise (optional but professional)
    const mapOrders = (side) => {
      const priceMap = {};

      orders
        .filter((o) => o.side === side)
        .forEach((order) => {
          if (!priceMap[order.price]) {
            priceMap[order.price] = 0;
          }
          priceMap[order.price] += order.remainingQuantity;
        });

      return Object.keys(priceMap)
        .sort((a, b) => b - a)
        .map((price) => ({
          price: Number(price),
          quantity: priceMap[price],
        }));
    };

    orderBook.yes = mapOrders("YES");
    orderBook.no = mapOrders("NO");

    return res
      .status(200)
      .json(
        responseHandler.success(orderBook, "Order book retrieved successfully")
      );
  } catch (error) {
    console.error("OrderBook Error:", error);
    return res
      .status(500)
      .json(responseHandler.error("Failed to fetch order book"));
  }
};

//Get My Event Details
import mongoose from "mongoose";

export const getMyEventDetails = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { filter = "all" } = req.query;
    // filter = all | unmatched | matched | sold | cancelled

    const userId = req.user._id;

    // 🔐 Handle ObjectId safely
    const eventQuery = mongoose.Types.ObjectId.isValid(eventId)
      ? new mongoose.Types.ObjectId(eventId)
      : eventId;

    /* ===============================
       1️⃣ FETCH USER ORDERS
       =============================== */
    const orders = await BetOrder.find({
      user: userId,
      event: eventQuery,
    })
      .sort({ createdAt: -1 })
      .lean();

    /* ===============================
       2️⃣ FETCH USER POSITIONS
       =============================== */
    const positions = await BetPosition.find({
      user: userId,
      event: eventQuery,
    }).lean();

    // Map positions by side
    const positionMap = {};
    positions.forEach((p) => {
      positionMap[p.side] = p;
    });

    /* ===============================
       3️⃣ CLASSIFY ORDERS
       =============================== */
    const unmatched = [];
    const matched = [];
    const sold = [];
    const cancelled = [];

    orders.forEach((order) => {
      if (order.status === "PENDING") {
        unmatched.push(order);
        return;
      }

      if (order.status === "MATCHED") {
        const pos = positionMap[order.side];
        if (!pos || pos.quantity > 0) matched.push(order);
        else sold.push(order);
        return;
      }

      if (order.status === "CANCELLED") {
        cancelled.push(order);
      }
    });

    /* ===============================
       4️⃣ INVESTMENT SUMMARY
       =============================== */
    const investment = {
      yes: { quantity: 0, invested: 0, avgPrice: 0 },
      no: { quantity: 0, invested: 0, avgPrice: 0 },
      totalInvested: 0,
      cancelledAmount: 0, // 🔥 NEW
    };

    // Active investment (positions)
    positions.forEach((pos) => {
      const key = pos.side.toLowerCase();
      investment[key].quantity = pos.quantity;
      investment[key].invested = pos.investedAmount;
      investment[key].avgPrice = pos.averagePrice;
      investment.totalInvested += pos.investedAmount;
    });

    // Cancelled investment (orders)
    cancelled.forEach((order) => {
      investment.cancelledAmount += order.amountLocked || 0;
    });

    /* ===============================
       5️⃣ SELL LISTING (OTHER USERS)
       =============================== */
    const sellListing = await BetOrder.find({
      event: eventQuery,
      type: "SELL",
      status: "PENDING",
      user: { $ne: userId },
    })
      .sort({ price: 1 })
      .lean();

    /* ===============================
       6️⃣ APPLY FILTER (IMPORTANT)
       =============================== */
    const filteredData = {
      investment,
      sellListing,
    };

    if (filter === "unmatched") filteredData.unmatched = unmatched;
    else if (filter === "matched") filteredData.matched = matched;
    else if (filter === "sold") filteredData.sold = sold;
    else if (filter === "cancelled") filteredData.cancelled = cancelled;
    else {
      // all
      filteredData.unmatched = unmatched;
      filteredData.matched = matched;
      filteredData.sold = sold;
      filteredData.cancelled = cancelled;
    }

    /* ===============================
       7️⃣ RESPONSE
       =============================== */
    res.status(200).json({
      status: true,
      data: filteredData,
      message: "User event details retrieved",
    });
  } catch (error) {
    console.error("getMyEventDetails ERROR:", error);
    res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

// Live score Api
export const getEventWithLiveScore = async (req, res) => {
  try {
    const { eventId } = req.params;

    const event = await BetEvent.findById(eventId).populate({
      path: "match",
      populate: [
        { path: "teamA", model: "Team" },
        { path: "teamB", model: "Team" },
      ],
    });

    if (!event || !event.match) {
      return res.status(404).json({
        status: false,
        message: "Event or match not found",
      });
    }

    const liveScore = await LiveScore.findOne({ eventId });

    let teamA = event.match.teamA;
    let teamB = event.match.teamB;

    /* 🔥 FALLBACK: OLD MATCH DATA SUPPORT */
    // Agar teamA / teamB ObjectId nahi mile
    if ((!teamA || !teamB) && event.match.teams?.length >= 2) {
      const [teamAName, teamBName] = event.match.teams;

      teamA = await Team.findOne({ name: teamAName });
      teamB = await Team.findOne({ name: teamBName });
    }

    /* 🔥 FLAG SAFETY */
    const teamAData = teamA
      ? {
          name: teamA.name,
          flag: teamA.flagUrl,
          score: liveScore?.teamA || null,
        }
      : {
          name: null,
          flag: null,
          score: liveScore?.teamA || null,
        };

    const teamBData = teamB
      ? {
          name: teamB.name,
          flag: teamB.flagUrl,
          score: liveScore?.teamB || null,
        }
      : {
          name: null,
          flag: null,
          score: liveScore?.teamB || null,
        };

    res.json({
      status: true,
      data: {
        eventId: event._id,
        question: event.question,
        matchStatus: event.match.status,
        status: liveScore?.status || "UPCOMING",
        teamA: teamAData,
        teamB: teamBData,
        updatedAt: liveScore?.updatedAt || null,
      },
    });
  } catch (err) {
    console.error("Live score error:", err);
    res.status(500).json({
      status: false,
      message: "Server error",
    });
  }
};
