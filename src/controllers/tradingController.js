import BetEvent from "../models/BetEvent.js";
import BetPosition from "../models/BetPosition.js";
import CricketMatch from "../models/CricketMatch.js";
import { placeOrder as placeOrderEngine, settleEvent as settleEventEngine } from "../services/tradingEngine.js";
import responseHandler from "../utils/responseHandler.js";

export const settleEventUser = async (req, res) => {
    try {
        const { eventId } = req.params;
        const { result } = req.body; // "YES" or "NO"

        if (!["YES", "NO"].includes(result)) {
            return res.status(400).json({ message: "Invalid result. Must be YES or NO" });
        }

        const outcome = await settleEventEngine(eventId, result);
        res.status(200).json(responseHandler.success(outcome, "Event settled successfully"));
    } catch (error) {
        res.status(500).json(responseHandler.error(error.message));
    }
};

export const getEvents = async (req, res) => {
    try {
        const events = await BetEvent.find({ status: "OPEN" }).populate("match");
        res.status(200).json(responseHandler.success(events, "Events retrieved successfully"));
    } catch (error) {
        res.status(500).json(responseHandler.error(error.message));
    }
};

export const placeOrder = async (req, res) => {
    try {
        const { eventId, type, side, price, quantity } = req.body;
        const userId = req.user._id;

        const result = await placeOrderEngine(userId, eventId, type, side, price, quantity);
        res.status(200).json(responseHandler.success(result, "Order placed successfully"));
    } catch (error) {
        res.status(400).json(responseHandler.error(error.message));
    }
};

export const getPortfolio = async (req, res) => {
    try {
        const userId = req.user._id;
        const positions = await BetPosition.find({ user: userId, quantity: { $gt: 0 } }).populate("event");
        res.status(200).json(responseHandler.success(positions, "Portfolio retrieved successfully"));
    } catch (error) {
        res.status(500).json(responseHandler.error(error.message));
    }
};

export const getHistory = async (req, res) => {
    try {
        const userId = req.user._id;
        // Fetch positions where the event is settled OR quantity is 0 (if we handled exits that way)
        // Better: Fetch all positions and let frontend filter, or filter by event status.
        // Since BetPosition doesn't store event status directly, we populate and filter.

        const positions = await BetPosition.find({ user: userId }).populate("event");

        const history = positions.filter(pos => pos.event.status === "SETTLED");

        res.status(200).json(responseHandler.success(history, "History retrieved successfully"));
    } catch (error) {
        res.status(500).json(responseHandler.error(error.message));
    }
};

export const getMatchesUser = async (req, res) => {
    try {
        const { filter } = req.query;
        let query = {};

        if (filter === "live") {
            // Matches that are currently running
            query = { status: { $regex: /live|in progress|started|running/i } };
        } else if (filter === "upcoming") {
            // Matches that are scheduled or in the future
            query = {
                $or: [
                    { status: { $regex: /scheduled|upcoming/i } },
                    { date: { $gt: new Date() } }
                ]
            };
        }

        const matches = await CricketMatch.find(query).sort({ date: 1 });
        res.status(200).json(responseHandler.success(matches, "Matches retrieved successfully"));
    } catch (error) {
        res.status(500).json(responseHandler.error(error.message));
    }
};

export const getEventsByMatch = async (req, res) => {
    try {
        const { matchId } = req.params;
        const events = await BetEvent.find({ match: matchId }).populate("match");
        res.status(200).json(responseHandler.success(events, "Events retrieved successfully"));
    } catch (error) {
        res.status(500).json(responseHandler.error(error.message));
    }
};
