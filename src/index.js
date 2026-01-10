import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { createServer } from "http";

import { connectDB } from "./config/db.js";
import { initializeSocket } from "./services/socketService.js";
import { startOrderTrackingService } from "./services/orderTrackingService.js";
import { fetchAndStoreMatches } from "./services/cricketService.js";

// Routes
import authRoutes from "./routes/authRoutes.js";
import cartRoutes from "./routes/cartRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import addressRoutes from "./routes/addressRoutes.js";
import categoryRoutes from "./routes/categoryRoutes.js";
import walletRoutes from "./routes/walletRoutes.js";
import customerRoutes from "./routes/customerRoutes.js";
import ticketRoutes from "./routes/ticketRoutes.js";
import spinWheelRoutes from "./routes/spinWheelRoutes.js";
import betRoutes from "./routes/betRoutes.js";

dotenv.config();

// 🔌 Connect DB
connectDB();

const app = express();
app.use(cors());

// Razorpay webhook (raw body)
app.use(
  "/api/orders/webhook/razorpay",
  express.raw({ type: "application/json" })
);

// Static uploads
app.use("/uploads", express.static("uploads"));

// JSON parser
app.use(express.json());

// Pagination middleware
app.use((req, _, next) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const offset = (page - 1) * limit;

  req.page = page;
  req.limit = limit;
  req.offset = offset;

  next();
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/products", productRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/addresses", addressRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/tickets", ticketRoutes);
app.use("/api/spin-wheel", spinWheelRoutes);
app.use("/api/betting", betRoutes);

// Health check
app.get("/", (_, res) =>
  res.send("E-commerce backend + Live Cricket running ✅")
);

const PORT = process.env.PORT || 3000;

// 🌐 Create HTTP server
const httpServer = createServer(app);

// 🔥 Initialize Socket.IO
initializeSocket(httpServer);

// 🔁 Start order tracking background service
startOrderTrackingService();

// 🔥🔥 LIVE CRICKET AUTO FETCH (REAL-TIME POLLING)
// CricAPI websocket nahi deta, isliye polling best solution hai
setInterval(async () => {
  try {
    console.log("⏱ Fetching live cricket matches...");
    await fetchAndStoreMatches();
  } catch (err) {
    console.error("Live match fetch error:", err.message);
  }
}, 30000); // every 30 seconds (safe for CricAPI)

// 🚀 Start server
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log(`🔌 Socket.IO initialized`);
  console.log(`🏏 Live cricket polling every 30 seconds`);
});
