import mongoose from "mongoose";
import BetOrder from "../models/BetOrder.js";

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

      // ✅ only current (OPEN) events
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

      // 🔥 GROUP BY MATCH + COLLECT EVENT IDS
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

          eventIds: { $addToSet: "$event._id" }, // ✅ NEW

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
          eventIds: 1, // ✅ expose
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
