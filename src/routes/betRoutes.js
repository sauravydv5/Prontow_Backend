import express from "express";
import {
  refreshMatches,
  addMatches,
  updateMatchStatus,
  getMatches,
  createEvent,
  settleEvent,
  getCustomerRecords,
} from "../controllers/adminEventController.js";

import {
  getEvents,
  getEventDetails,
  getOrderBook,
  getMyEventDetails,
  placeOrder,
  settleEventUser,
  getPortfolio,
  getHistory,
  getMatchesUser,
  getEventsByMatch,
  getEventWithLiveScore,
} from "../controllers/tradingController.js";

import protect, { adminOnly as admin } from "../middleware/authMiddleware.js";

const router = express.Router();

/* ======================================================
   PUBLIC / USER ROUTES
====================================================== */

// All events (optional filters)
router.get("/events", getEvents);

// ✅ Event details by eventId
router.get("/events/:eventId/details", getEventDetails);

// Public matches list
router.get("/matches", getMatchesUser);

// Events of a specific match
router.get("/matches/:matchId/events", getEventsByMatch);

// Place order (BUY / SELL)
router.post("/order", protect, placeOrder);

// User side event settlement
router.post("/settle-event/:eventId", protect, settleEventUser);

// User portfolio
router.get("/portfolio", protect, getPortfolio);

// User trade history
router.get("/history", protect, getHistory);

// ✅ Event order book
router.get("/events/:eventId/orderbook", getOrderBook);

// ✅ My orders for a specific event
router.get("/events/:eventId/my-details", protect, getMyEventDetails);

//Live Score
router.get("/events/:eventId/live", getEventWithLiveScore);
/* ======================================================
   ADMIN ROUTES
====================================================== */

// Refresh matches from API
router.post("/admin/refresh-matches", protect, admin, refreshMatches);

router.post("/admin/add-matches", addMatches);

router.patch("/admin/update-match-status", updateMatchStatus);

// Admin match list
router.get("/admin/matches", protect, admin, getMatches);

// Create betting event
router.post("/admin/create-event", protect, admin, createEvent);

// Admin event settlement
router.post("/admin/settle-event/:eventId", protect, admin, settleEvent);

// Admin customer trading records
router.get("/admin/customers", protect, admin, getCustomerRecords);

export default router;
