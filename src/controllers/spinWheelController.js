import SpinWheel from "../models/spinWheel.js";
import User from "../models/user.js";
import SpinRecord from "../models/spinRecord.js";
import responseHandler from "../utils/responseHandler.js";

/**
 * Admin: Create a new Spin Wheel
 */
export const createSpinWheel = async (req, res) => {
    try {
        const { name, description, sections, isActive } = req.body;

        if (!name) {
            return res.status(400).json(responseHandler.error("Spin wheel name is required"));
        }

        if (!sections || !Array.isArray(sections)) {
            return res.status(400).json(responseHandler.error("Sections must be an array"));
        }

        if (sections.length < 4 || sections.length > 8) {
            return res.status(400).json(responseHandler.error("Wheel must have between 4 and 8 sections"));
        }

        const spinWheel = await SpinWheel.create({
            name,
            description,
            sections,
            isActive: isActive
        });

        if (isActive) {
            await SpinWheel.updateMany({ _id: { $ne: spinWheel._id }, isActive: true }, { isActive: false });
        }

        return res.status(201).json(responseHandler.success(spinWheel, "Spin wheel created successfully"));
    } catch (err) {
        return res.status(500).json(responseHandler.error(err.message));
    }
};

/**
 * Admin: Get All Spin Wheels
 */
export const getAllSpinWheels = async (req, res) => {
    try {
        const spinWheels = await SpinWheel.find().sort({ createdAt: -1 });
        return res.status(200).json(responseHandler.success(spinWheels, "Spin wheels fetched successfully"));
    } catch (err) {
        return res.status(500).json(responseHandler.error(err.message));
    }
};

/**
 * User: Get All Active Spin Wheels
 */
export const getActiveSpinWheels = async (req, res) => {
    try {
        const spinWheels = await SpinWheel.find({ isActive: true }).sort({ createdAt: -1 });
        return res.status(200).json(responseHandler.success(spinWheels, "Active spin wheels fetched successfully"));
    } catch (err) {
        return res.status(500).json(responseHandler.error(err.message));
    }
};

/**
 * Admin: Get Specific Spin Wheel by ID
 */
export const getSpinWheelById = async (req, res) => {
    try {
        const { id } = req.params;
        const spinWheel = await SpinWheel.findById(id);

        if (!spinWheel) {
            return res.status(404).json(responseHandler.error("Spin wheel not found"));
        }

        return res.status(200).json(responseHandler.success(spinWheel, "Spin wheel fetched successfully"));
    } catch (err) {
        return res.status(500).json(responseHandler.error(err.message));
    }
};

/**
 * Admin: Update Spin Wheel
 */
export const updateSpinWheel = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, sections, isActive } = req.body;

        const spinWheel = await SpinWheel.findById(id);
        if (!spinWheel) {
            return res.status(404).json(responseHandler.error("Spin wheel not found"));
        }

        if (name) spinWheel.name = name;
        if (description !== undefined) spinWheel.description = description;

        if (isActive !== undefined) {
            spinWheel.isActive = isActive;
            if (isActive) {
                await SpinWheel.updateMany({ _id: { $ne: id }, isActive: true }, { isActive: false });
            }
        }

        if (sections) {
            if (!Array.isArray(sections)) {
                return res.status(400).json(responseHandler.error("Sections must be an array"));
            }
            if (sections.length < 4 || sections.length > 8) {
                return res.status(400).json(responseHandler.error("Wheel must have between 4 and 8 sections"));
            }
            spinWheel.sections = sections;
        }

        await spinWheel.save();

        return res.status(200).json(responseHandler.success(spinWheel, "Spin wheel updated successfully"));
    } catch (err) {
        return res.status(500).json(responseHandler.error(err.message));
    }
};

/**
 * Admin: Delete Spin Wheel
 */
export const deleteSpinWheel = async (req, res) => {
    try {
        const { id } = req.params;
        const spinWheel = await SpinWheel.findByIdAndDelete(id);

        if (!spinWheel) {
            return res.status(200).json(responseHandler.success(null, "Spin wheel already deleted or not found"));
        }

        return res.status(200).json(responseHandler.success(null, "Spin wheel deleted successfully"));
    } catch (err) {
        return res.status(500).json(responseHandler.error(err.message));
    }
};

/**
 * User: Spin a Specific Wheel
 */
export const spinWheel = async (req, res) => {
    try {
        const userId = req.user.id;
        const { tokensToUse } = req.body;

        if (!tokensToUse || tokensToUse <= 0) {
            return res.status(400).json(responseHandler.error("Invalid tokens amount"));
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json(responseHandler.error("User not found"));
        }

        if (user.gameTokens < tokensToUse) {
            return res.status(400).json(responseHandler.error("Insufficient game tokens"));
        }

        // Find the latest active spin wheel
        const spinWheel = await SpinWheel.findOne({ isActive: true }).sort({ createdAt: -1 });

        if (!spinWheel) {
            return res.status(404).json(responseHandler.error("No active spin wheel found"));
        }

        if (!spinWheel.sections || spinWheel.sections.length === 0) {
            return res.status(400).json(responseHandler.error("Spin wheel sections not configured"));
        }

        // Deduct tokens
        user.gameTokens -= tokensToUse;

        // Select random section based on probability
        const sections = spinWheel.sections;
        const totalWeight = sections.reduce((sum, section) => sum + (section.probability || 1), 0);
        let random = Math.random() * totalWeight;

        let winningSection = sections[sections.length - 1]; // Default to last
        for (const section of sections) {
            const weight = section.probability || 1;
            if (random < weight) {
                winningSection = section;
                break;
            }
            random -= weight;
        }

        // Apply Prize
        if (winningSection.type === "cash") {
            user.winningCash = (user.winningCash || 0) + winningSection.value;
        } else if (winningSection.type === "token") {
            user.gameTokens += winningSection.value;
        }

        await user.save();

        // Create Spin Record
        await SpinRecord.create({
            user: user._id,
            spinWheel: spinWheel._id,
            winningSection: {
                title: winningSection.title,
                type: winningSection.type,
                value: winningSection.value,
                color: winningSection.color
            },
            tokensUsed: tokensToUse
        });

        return res.status(200).json(responseHandler.success({
            result: winningSection,
            updatedUser: {
                gameTokens: user.gameTokens,
                winningCash: user.winningCash
            }
        }, "Spin successful"));

    } catch (err) {
        return res.status(500).json(responseHandler.error(err.message));
    }
};

/**
 * Admin: Get All Spin Records
 */
export const getAllSpinRecords = async (req, res) => {
    try {
        const records = await SpinRecord.find()
            .populate("user", "name email")
            .populate("spinWheel", "name")
            .sort({ createdAt: -1 });

        return res.status(200).json(responseHandler.success(records, "Spin records fetched successfully"));
    } catch (err) {
        return res.status(500).json(responseHandler.error(err.message));
    }
};
