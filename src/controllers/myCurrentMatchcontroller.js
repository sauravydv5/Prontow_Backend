import mongoose from "mongoose";
import BetOrder from "../models/BetOrder.js";

/* ===============================
   1️⃣ CURRENT MATCH LIST
================================ */
export const myCurrentMatch = async (req, res) => {
  try {
    const userId = req.user._id;

    const data = await BetOrder.aggregate([
      {
        $match: {
          user: userId,
          status: { $in: ["PENDING", "MATCHED"] },
        },
      },
      {
        $lookup: {
          from: "betevents",
          localField: "event",
          foreignField: "_id",
          as: "event",
        },
      },
      { $unwind: "$event" },

      { $match: { "event.status": "OPEN" } },

      {
        $lookup: {
          from: "cricketmatches",
          localField: "event.match",
          foreignField: "_id",
          as: "match",
        },
      },
      { $unwind: "$match" },

      {
        $addFields: {
          investedAmount: "$amountLocked",
          matchedAmount: {
            $multiply: [
              "$price",
              { $subtract: ["$quantity", "$remainingQuantity"] },
            ],
          },
          pendingAmount: {
            $subtract: [
              "$amountLocked",
              {
                $multiply: [
                  "$price",
                  { $subtract: ["$quantity", "$remainingQuantity"] },
                ],
              },
            ],
          },
        },
      },

      {
        $group: {
          _id: "$match._id",
          matchName: {
            $first: {
              $cond: [
                { $ifNull: ["$match.name", false] },
                "$match.name",
                { $concat: ["$match.teamA", " vs ", "$match.teamB"] },
              ],
            },
          },
          totalInvested: { $sum: "$investedAmount" },
          totalMatched: { $sum: "$matchedAmount" },
          totalPending: { $sum: "$pendingAmount" },
        },
      },

      {
        $project: {
          _id: 0,
          matchId: "$_id",
          matchName: 1,
          totalInvested: 1,
          totalMatched: 1,
          totalPending: 1,
        },
      },
    ]);

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ===============================
   2️⃣ CURRENT MATCH → EVENTS
================================ */
export const myCurrentMatchEvents = async (req, res) => {
  try {
    const userId = req.user._id;
    const { matchId } = req.params;

    const data = await BetOrder.aggregate([
      {
        $match: {
          user: userId,
          status: { $in: ["PENDING", "MATCHED"] },
        },
      },
      {
        $lookup: {
          from: "betevents",
          localField: "event",
          foreignField: "_id",
          as: "event",
        },
      },
      { $unwind: "$event" },

      {
        $match: {
          "event.match": new mongoose.Types.ObjectId(matchId),
          "event.status": "OPEN",
        },
      },

      {
        $addFields: {
          investedAmount: "$amountLocked",
          matchedAmount: {
            $multiply: [
              "$price",
              { $subtract: ["$quantity", "$remainingQuantity"] },
            ],
          },
          pendingAmount: {
            $subtract: [
              "$amountLocked",
              {
                $multiply: [
                  "$price",
                  { $subtract: ["$quantity", "$remainingQuantity"] },
                ],
              },
            ],
          },
        },
      },

      {
        $group: {
          _id: "$event._id",
          eventQuestion: { $first: "$event.question" },
          totalInvested: { $sum: "$investedAmount" },
          totalMatched: { $sum: "$matchedAmount" },
          totalPending: { $sum: "$pendingAmount" },
        },
      },

      {
        $project: {
          _id: 0,
          eventId: "$_id",
          eventQuestion: 1,
          totalInvested: 1,
          totalMatched: 1,
          totalPending: 1,
        },
      },
    ]);

    res.json({ success: true, matchId, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ===============================
   3️⃣ EVENT DETAIL
================================ */
export const myCurrentMatchDetail = async (req, res) => {
  try {
    const userId = req.user._id;
    const { eventId } = req.params;

    const data = await BetOrder.aggregate([
      {
        $match: {
          user: userId,
          event: new mongoose.Types.ObjectId(eventId),
          status: { $in: ["PENDING", "MATCHED"] },
        },
      },
      {
        $addFields: {
          investedAmount: "$amountLocked",
          matchedAmount: {
            $multiply: [
              "$price",
              { $subtract: ["$quantity", "$remainingQuantity"] },
            ],
          },
          pendingAmount: {
            $subtract: [
              "$amountLocked",
              {
                $multiply: [
                  "$price",
                  { $subtract: ["$quantity", "$remainingQuantity"] },
                ],
              },
            ],
          },
        },
      },
      {
        $group: {
          _id: { side: "$side", type: "$type" },
          totalInvested: { $sum: "$investedAmount" },
          totalMatched: { $sum: "$matchedAmount" },
          totalPending: { $sum: "$pendingAmount" },
        },
      },
      {
        $project: {
          _id: 0,
          side: "$_id.side",
          type: "$_id.type",
          totalInvested: 1,
          totalMatched: 1,
          totalPending: 1,
        },
      },
    ]);

    res.json({ success: true, eventId, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
