import mongoose from "mongoose";
import BetEvent from "../models/BetEvent.js";
import CricketMatch from "../models/CricketMatch.js";
import { settleEvent as settleEventEngine } from "../services/tradingEngine.js";
import { fetchAndStoreMatches } from "../services/cricketService.js";
import User from "../models/user.js";

export const refreshMatches = async (req, res) => {
    try {
        await fetchAndStoreMatches();
        res.status(200).json({ message: "Matches refreshed successfully" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const getMatches = async (req, res) => {
    try {
        const matches = await CricketMatch.find().sort({ date: 1 });
        res.status(200).json(matches);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const createEvent = async (req, res) => {
    try {
        const { question, matchId, endTime, yesPrice, noPrice } = req.body;

        if (!mongoose.Types.ObjectId.isValid(matchId)) {
            return res.status(400).json({ message: "Invalid matchId. Must be a valid MongoDB ObjectId." });
        }

        const event = new BetEvent({
            question,
            match: matchId,
            endTime,
            yesPrice, // Initial price
            noPrice,
            currentYesPrice: yesPrice,
            currentNoPrice: noPrice,
             status: "OPEN",
            createdBy: req.user._id
        });

        await event.save();
        res.status(201).json(event);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const settleEvent = async (req, res) => {
    try {
        const { eventId } = req.params;
        const { result } = req.body; // "YES" or "NO"

        if (!["YES", "NO"].includes(result)) {
            return res.status(400).json({ message: "Invalid result. Must be YES or NO" });
        }

        const outcome = await settleEventEngine(eventId, result);
        res.status(200).json({ message: "Event settled successfully", outcome });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const getCustomerRecords = async (req, res) => {
    try {
        // Fetch all customers and their betting stats if needed
        // For now, just return all users with role 'customer'
        const customers = await User.find({ role: "customer" }).select("-password");
        res.status(200).json(customers);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
