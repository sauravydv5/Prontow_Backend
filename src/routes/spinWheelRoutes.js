import express from "express";
import protect, { adminOnly } from "../middleware/authMiddleware.js";
import {
    createSpinWheel,
    getAllSpinWheels,
    getSpinWheelById,
    updateSpinWheel,
    deleteSpinWheel,
    spinWheel,
    getAllSpinRecords,
    getActiveSpinWheels
} from "../controllers/spinWheelController.js";

const router = express.Router();

// Admin: Create new Wheel
router.post("/", protect, createSpinWheel);

// Admin: Get All Wheels
router.get("/", protect, getAllSpinWheels);

// Admin: Get All Spin Records
router.get("/records", protect, adminOnly, getAllSpinRecords);

// User: Get All Active Wheels
router.get("/active", protect, getActiveSpinWheels);

// Admin: Get Specific Wheel
router.get("/:id", protect, getSpinWheelById);

// Admin: Update Wheel
router.put("/:id", protect, updateSpinWheel);

// Admin: Delete Wheel
router.delete("/:id", protect, deleteSpinWheel);

// User: Spin the latest active Wheel
router.post("/spin", protect, spinWheel);





export default router;
