import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { createServer } from "http";

import { connectDB } from "./config/db.js";
import { initializeSocket, initSocket } from "./services/socketService.js";

import { startOrderTrackingService } from "./services/orderTrackingService.js";
import { startLiveScoreWorker } from "./services/liveScoreWorker.js";

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
import testMatchesRoutes from "./routes/testMatches.js";

dotenv.config();

/* ============================
   🔌 DATABASE CONNECTION
============================ */
connectDB();

/* ============================
   🚀 EXPRESS APP
============================ */
const app = express();
app.use(cors());

/* ============================
   💳 Razorpay webhook (RAW BODY)
============================ */
app.use(
  "/api/orders/webhook/razorpay",
  express.raw({ type: "application/json" })
);

/* ============================
   📂 Static uploads
============================ */
app.use("/uploads", express.static("uploads"));

/* ============================
   🧾 JSON parser
============================ */
app.use(express.json());

/* ============================
   📄 Pagination middleware
============================ */
app.use((req, _, next) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const offset = (page - 1) * limit;

  req.page = page;
  req.limit = limit;
  req.offset = offset;

  next();
});

/* ============================
   🛣️ ROUTES
============================ */
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
app.use("/api/test", testMatchesRoutes);

/* ============================
   ❤️ HEALTH CHECK
============================ */
app.get("/", (_, res) => {
  res.send("E-commerce backend + Cricket betting running ✅");
});

const PORT = process.env.PORT || 5000;

/* ============================
   🌐 HTTP SERVER
============================ */
const httpServer = createServer(app);

/* ============================
   🔌 SOCKET.IO INIT (🔥 FIXED)
============================ */
const io = initializeSocket(httpServer); // ✅ socket server create
initSocket(io); // ✅ ioInstance set (IMPORTANT)

/* ============================
   🔁 BACKGROUND SERVICES
============================ */
startOrderTrackingService();
startLiveScoreWorker(); // 🔴 live score → socket emit

/* ============================
   🚀 START SERVER
============================ */
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log(`🔌 Socket.IO initialized`);
});
