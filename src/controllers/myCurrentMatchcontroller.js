import mongoose from "mongoose";
import BetOrder from "../models/BetOrder.js";

export const myCurrentMatch = async (req, res) => {
  try {
    const userId = req.user._id;

    const data = await BetOrder.aggregate([
      /* 1️⃣ USER KE ORDERS (ignore cancelled) */
      {
        $match: {
          user: userId,
          status: { $ne: "CANCELLED" },
        },
      },

      /* 2️⃣ EVENT JOIN */
      {
        $lookup: {
          from: "betevents",
          localField: "event",
          foreignField: "_id",
          as: "event",
        },
      },
      { $unwind: "$event" },

      /* 3️⃣ ONLY CURRENT EVENTS */
      {
        $match: {
          "event.status": { $in: ["OPEN", "LIVE"] },
        },
      },

      /* 4️⃣ MATCH JOIN */
      {
        $lookup: {
          from: "cricketmatches",
          localField: "event.match",
          foreignField: "_id",
          as: "match",
        },
      },
      { $unwind: "$match" },

      /* 5️⃣ GROUP BY MATCH (unique) */
      {
        $group: {
          _id: "$match._id",
          matchName: { $first: "$match.name" },
        },
      },

      /* 6️⃣ FINAL SHAPE */
      {
        $project: {
          _id: 0,
          matchId: "$_id",
          matchName: 1,
        },
      },
    ]);

    res.json({
      success: true,
      data,
    });
  } catch (err) {
    console.error("myCurrentMatch ERROR:", err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};
