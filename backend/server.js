require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const helmet = require("helmet");
const compression = require("compression");
const pinoHttp = require("pino-http")();
const rateLimit = require("express-rate-limit");
const fs = require("fs");
const connectDB = require("./config/db");
const { errorHandler, notFound } = require("./src/middleware/error");

// Import routes
const dashboardRoutes = require("./src/routes/dashboardRoutes");
const teamRoutes = require("./src/routes/teamRoutes");
const expenseRoutes = require("./src/routes/expenseRoutes");

const app = express();
app.set("trust proxy", 1);

// Middleware to handle CORS
app.use(
    cors({
        origin: (origin, cb) => cb(null, true),
        methods: ["GET", "POST", "PUT", "DELETE"],
        allowedHeaders: ["Content-Type", "Authorization"],
        credentials: true,
    })
);

// Security headers
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
}));

// Logging
app.use(pinoHttp);

// Body parser middleware
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// Compression
app.use(compression());

// Ensure uploads directory exists and serve it statically
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use("/uploads", express.static(uploadsDir));

// Connect to MongoDB
connectDB();

// API Routes
// Basic rate limiting per route group
const apiLimiter = rateLimit({
    windowMs: (parseInt(process.env.RATE_LIMIT_WINDOW_MS || "60000", 10)),
    max: (parseInt(process.env.RATE_LIMIT_MAX || "120", 10)),
    standardHeaders: true,
    legacyHeaders: false,
});

app.use("/api/v1/dashboard", apiLimiter, dashboardRoutes);
app.use("/api/v1/teams", apiLimiter, teamRoutes);
app.use("/api/v1/expenses", apiLimiter, expenseRoutes);

// Health check endpoint
app.get("/api/health", (req, res) => {
    res.status(200).json({ status: "OK", message: "Team Expense Management API is running" });
});

// 404 and error handlers
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Health check available at: http://localhost:${PORT}/api/health`);
});