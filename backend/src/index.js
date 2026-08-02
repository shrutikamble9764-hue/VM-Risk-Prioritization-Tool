require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const authRoutes = require("./routes/auth.routes");
const assetRoutes = require("./routes/asset.routes");
const findingRoutes = require("./routes/finding.routes");
const ticketRoutes = require("./routes/ticket.routes");
const dashboardRoutes = require("./routes/dashboard.routes");
const reportRoutes = require("./routes/report.routes");
const adminRoutes = require("./routes/admin.routes");
const seedRoutes = require("./routes/seed.routes");
const { startScheduler } = require("./services/scheduler");

const app = express();

// --- Security headers (protects against common web vulnerabilities) ---
app.use(helmet());

// --- CORS: only the exact configured frontend origin(s) may call this API ---
// No wildcard fallback - if FRONTEND_URL isn't set, no browser origin is trusted.
const allowedOrigins = (process.env.FRONTEND_URL || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non-browser tools (curl, server-to-server) which send no origin
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("Not allowed by CORS"));
    },
  })
);

app.use(express.json());

// --- Rate limiting: prevents brute-force login attempts and general abuse ---
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per IP per window
  message: { error: "Too many login attempts. Please try again in 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300, // generous overall ceiling per IP
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api/", generalLimiter);
app.use("/api/auth/login", loginLimiter);

app.get("/health", (req, res) => res.json({ status: "ok", time: new Date().toISOString() }));

app.use("/api/auth", authRoutes);
app.use("/api/assets", assetRoutes);
app.use("/api/findings", findingRoutes);
app.use("/api/tickets", ticketRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/seed", seedRoutes);

// Generic error handler so the API never crashes silently
app.use((err, req, res, next) => {
  console.error("[unhandled error]", err);
  res.status(500).json({ error: "Internal server error" });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`VM Platform API running on port ${PORT}`);
  if (allowedOrigins.length === 0) {
    console.warn("[security warning] FRONTEND_URL is not set - no browser origin is currently trusted by CORS.");
  }
  startScheduler();
});
