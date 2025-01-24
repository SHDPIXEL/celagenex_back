require("dotenv").config();
const express = require("express");
const fileUpload = require("express-fileupload");
const Redis = require('ioredis');
const cors = require("cors");
const fs = require('fs');
const path = require('path');

require("./connection");
require("./models/form");
require("./models/videos");

//PORT
const PORT = process.env.PORT || 4000;
const redis = new Redis(); // Defaults to localhost:6379

redis.ping().then((res) => {
  console.log('Redis is working:', res); // Should print "PONG"
}).catch((err) => {
  console.error('Redis connection error:', err);
});

if (PORT === 4000) {
  console.error(
    "Error: No port specified. Please set the PORT environment variable."
  );
  process.exit(1); // Exit the application with an error
}

const app = express();
app.use(cors());
//admin routes
const authadminRouter = require("./routes/authAdminRoutes");
const authuserRouter = require("./routes/authUserRoutes");
const videoRoutes = require('./routes/videoRoutes');
const videoWorker = require('./batch/worker');

//user Routes

//Middleware to parse JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // For URL-encoded payloads
app.use(fileUpload()); // For handling form-data (files)

// Serve static files (uploaded files)
app.use("/uploads", express.static("uploads"));

app.get("/", (req, res) => {
  res.status(403).json({
    status: true,
    message: "Not allowed",
  });
});

// Admin routes
app.use("/api/auth", authadminRouter);

//User routes
app.use("/auth/user", authuserRouter);
app.use('/api/videos', videoRoutes);

// Create necessary directories
const dirs = ['uploads/images', 'uploads/videos', 'uploads/processed', 'templates'];
dirs.forEach(dir => {
  const dirPath = path.join(__dirname, dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`App is running on http://0.0.0.0:${PORT}`);
});
