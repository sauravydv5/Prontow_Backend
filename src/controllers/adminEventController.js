import mongoose from "mongoose";
import BetEvent from "../models/BetEvent.js";
import CricketMatch from "../models/CricketMatch.js";
import { settleEvent as settleEventEngine } from "../services/tradingEngine.js";
import { fetchAndStoreMatches } from "../services/cricketService.js";
import User from "../models/user.js";

/* =====================================================
   🔄 REFRESH MATCHES (ADMIN)
   - Fetch live + upcoming from CricAPI
===================================================== */
export const refreshMatches = async (req, res) => {
  try {
    const matches = await fetchAndStoreMatches();
    res.status(200).json({
      success: true,
      message: "Matches refreshed successfully",
      count: matches.length,
      data: matches,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/* =====================================================
   📋 ADD STATIC MATCHES API
===================================================== */
export const addMatches = async (req, res) => {
  try {
    const matches = req.body;

    // 🛑 Validation
    if (!Array.isArray(matches) || matches.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please send matches as an array",
      });
    }

    const bulkOps = matches.map((match) => {
      if (!match.apiMatchId || !match.name) {
        throw new Error("apiMatchId and name are required");
      }

      return {
        updateOne: {
          filter: { apiMatchId: match.apiMatchId },
          update: { $set: match },
          upsert: true,
        },
      };
    });

    await CricketMatch.bulkWrite(bulkOps);

    res.status(201).json({
      success: true,
      message: "Matches added/updated successfully",
      count: matches.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/* =====================================================
   📋 GET MATCHES (LIVE + UPCOMING ONLY)
===================================================== */

export const getMatches = async (req, res) => {
  try {
    // 🔥 aaj + kal + next 3 din
    const endDate = new Date();
    endDate.setUTCDate(endDate.getUTCDate() + 5);

    const matches = await CricketMatch.find({
      dateTimeGMT: { $lte: endDate },
    }).sort({ dateTimeGMT: 1 });

    res.status(200).json({
      success: true,
      count: matches.length,
      data: matches,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/* =====================================================
   ❓ CREATE BET EVENT (ADMIN)
===================================================== */
export const createEvent = async (req, res) => {
  try {
    const { question, matchId, endTime, yesPrice, noPrice } = req.body;

    if (!mongoose.Types.ObjectId.isValid(matchId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid matchId",
      });
    }

    const matchExists = await CricketMatch.findById(matchId);
    if (!matchExists) {
      return res.status(404).json({
        success: false,
        message: "Match not found",
      });
    }

    const event = await BetEvent.create({
      question,
      match: matchId,
      endTime,
      yesPrice,
      noPrice,
      currentYesPrice: yesPrice,
      currentNoPrice: noPrice,
      status: "OPEN",
      createdBy: req.user._id,
    });

    res.status(201).json({
      success: true,
      data: event,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/* =====================================================
   ✅ SETTLE EVENT (ADMIN)
===================================================== */
export const settleEvent = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { result } = req.body; // YES | NO

    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid eventId",
      });
    }

    if (!["YES", "NO"].includes(result)) {
      return res.status(400).json({
        success: false,
        message: "Result must be YES or NO",
      });
    }

    const outcome = await settleEventEngine(eventId, result);

    res.status(200).json({
      success: true,
      message: "Event settled successfully",
      outcome,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/* =====================================================
   👤 GET ALL CUSTOMERS (ADMIN)
===================================================== */
export const getCustomerRecords = async (req, res) => {
  try {
    const customers = await User.find({ role: "customer" }).select("-password");

    res.status(200).json({
      success: true,
      count: customers.length,
      data: customers,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
