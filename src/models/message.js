import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
    ticket: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Ticket",
        required: true
    },
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    senderRole: {
        type: String,
        enum: ["USER", "ADMIN"],
        required: true
    },
    content: {
        type: String,
        required: true
    },
    attachments: [{
        type: String // URL/Path to the file
    }]
}, { timestamps: true });

export const Message = mongoose.model("Message", messageSchema);
