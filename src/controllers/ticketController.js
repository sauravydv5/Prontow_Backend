import { Ticket } from "../models/ticket.js";
import { Message } from "../models/message.js";
import { getIO } from "../services/socketService.js";
import responseHandler from "../utils/responseHandler.js";

export const createTicket = async (req, res) => {
    try {
        const { subject, issueType } = req.body;
        const ticket = await Ticket.create({
            user: req.user._id,
            subject,
            issueType,
            status: "OPEN"
        });
        res.status(201).json(responseHandler.success(ticket, "ticket added successfully"));
    } catch (error) {
        res.status(500).json(responseHandler.error("Error creating ticket", error.message));
    }
};

export const getUserTickets = async (req, res) => {
    try {
        const tickets = await Ticket.find({ user: req.user._id }).sort({ createdAt: -1 });
        res.json(responseHandler.success(tickets, "tickets fetched successfully"));
    } catch (error) {
        res.status(500).json(responseHandler.error("Error fetching tickets", error.message));
    }
};

export const getAllTickets = async (req, res) => {
    try {
        const tickets = await Ticket.find().populate("user", "name email").sort({ createdAt: -1 });
        res.json(responseHandler.success(tickets, "tickets fetched successfully"));
    } catch (error) {
        res.status(500).json(responseHandler.error("Error fetching all tickets", error.message));
    }
};

export const addMessage = async (req, res) => {
    try {
        const { ticketId } = req.params;
        const { content, message: msgContent } = req.body;
        const messageContent = content || msgContent;
        const senderRole = req.user.role === "admin" ? "ADMIN" : "USER";

        // Check if ticket exists
        const ticketExists = await Ticket.findById(ticketId);
        if (!ticketExists) {
            return res.status(404).json(responseHandler.error("Ticket not found"));
        }

        let attachments = [];
        if (req.files && req.files.length > 0) {
            attachments = req.files.map(file => `/uploads/${file.filename}`);
        }

        const message = await Message.create({
            ticket: ticketId,
            sender: req.user._id,
            senderRole,
            content: messageContent,
            attachments
        });

        // Update ticket updated time
        await Ticket.findByIdAndUpdate(ticketId, { updatedAt: new Date() });

        // Emit socket event
        try {
            const io = getIO();
            io.to(`ticket-${ticketId}`).emit("new-message", message);
        } catch (err) {
            console.error("Socket emission failed:", err);
        }

        res.status(201).json(responseHandler.success(message, "Message sent successfully"));
    } catch (error) {
        res.status(500).json(responseHandler.error("Error sending message", error.message));
    }
};

export const getTicketMessages = async (req, res) => {
    try {
        const { ticketId } = req.params;
        const messages = await Message.find({ ticket: ticketId }).populate("sender", "name").sort({ createdAt: 1 });
        res.json(responseHandler.success(messages, "Messages fetched successfully"));
    } catch (error) {
        res.status(500).json(responseHandler.error("Error fetching messages", error.message));
    }
};

export const updateTicketStatus = async (req, res) => {
    try {
        const { ticketId } = req.params;
        const { status } = req.body;

        const ticket = await Ticket.findByIdAndUpdate(
            ticketId,
            { status },
            { new: true }
        );

        if (!ticket) {
            return res.status(404).json(responseHandler.error("Ticket not found"));
        }

        // Emit status update event
        try {
            const io = getIO();
            io.to(`ticket-${ticketId}`).emit("ticket-status-update", { status });
        } catch (err) {
            console.error("Socket emission failed:", err);
        }

        res.json(responseHandler.success(ticket, "Ticket status updated successfully"));
    } catch (error) {
        res.status(500).json(responseHandler.error("Error updating ticket status", error.message));
    }
};
