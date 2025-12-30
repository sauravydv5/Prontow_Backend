import jwt from "jsonwebtoken";
import User from "../models/user.js";
import { USER_ROLES } from "../constants/auth.js"

// Protect route (JWT)
const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ message: "Invalid or expired token" });
  }
};

// Admin-only middleware
const adminOnly = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required before checking admin status." });
  }

  if (req.user.role === USER_ROLES.ADMIN) {
    next();
  } else {
    res.status(403).json({ message: "Access denied. Admin only." });
  }
};

export default protect;
export { adminOnly };
