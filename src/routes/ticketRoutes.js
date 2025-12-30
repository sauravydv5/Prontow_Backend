import express from "express";
import {
    createTicket,
    getUserTickets,
    getAllTickets,
    addMessage,
    getTicketMessages,
    updateTicketStatus
} from "../controllers/ticketController.js";
import protect, { adminOnly } from "../middleware/authMiddleware.js";

import { upload } from "../middleware/uploadMiddleware.js";

const router = express.Router();

router.post("/", protect, createTicket);
router.get("/my-tickets", protect, getUserTickets);
router.get("/all", protect, adminOnly, getAllTickets); // Admin only
router.post("/:ticketId/messages", protect, upload.any(), addMessage);
router.get("/:ticketId/messages", protect, getTicketMessages);
router.patch("/:ticketId/status", protect, adminOnly, updateTicketStatus); // Admin only

export default router;
