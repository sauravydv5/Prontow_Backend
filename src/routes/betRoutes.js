import express from "express";
import {
    refreshMatches,
    getMatches,
    createEvent,
    settleEvent,
    getCustomerRecords
} from "../controllers/adminEventController.js";
import {
    getEvents,
    placeOrder,
    settleEventUser,
    getPortfolio,
    getHistory,
    getMatchesUser,
    getEventsByMatch
} from "../controllers/tradingController.js";
import protect, { adminOnly as admin } from "../middleware/authMiddleware.js";

const router = express.Router();

// Public/User Routes
router.get("/events", getEvents);
router.get("/matches", getMatchesUser); // Publicly accessible matches
router.get("/matches/:matchId/events", getEventsByMatch); // Get events for a specific match
router.post("/order", protect, placeOrder);
router.post("/settle-event/:eventId", protect, settleEventUser); // User-side settlement
router.get("/portfolio", protect, getPortfolio);
router.get("/history", protect, getHistory);

// Admin Routes
router.post("/admin/refresh-matches", protect, admin, refreshMatches);
router.get("/admin/matches", protect, admin, getMatches);
router.post("/admin/create-event", protect, admin, createEvent);
router.post("/admin/settle-event/:eventId", protect, admin, settleEvent);
router.get("/admin/customers", protect, admin, getCustomerRecords);

export default router;
