// server.js
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const admin = require("firebase-admin");

// Import Routes
const authRoutes = require("./routes/auth");
const tripsRoutes = require("./routes/trips");
const tripDetailsRoutes = require("./routes/tripDetails");
const tripAIRoutes = require("./routes/tripAI");
const placesRoutes = require("./routes/places");
const citiesRoutes = require("./routes/cities");


// Firebase Admin SDK
const serviceAccount = require("./milan-4590e-firebase-adminsdk-bdtkc-0d446a74c2.json");

// Initialize Firebase Admin only once
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: "milan-4590e.appspot.com", // ✅ Bucket name added
  });
}

// Export reusable handles
const db = admin.firestore();
const bucket = admin.storage().bucket();

// Express setup
const app = express();
app.use(cors());
app.use(bodyParser.json());

// Simple health check
app.get("/", (req, res) => {
  res.send("🌍 GoTravels Backend Live — Auth + Trips API");
});

// Attach routes
app.use("/api/auth", authRoutes);
app.use("/api/trips", tripsRoutes(db, bucket)); // ✅ Pass db & bucket here
app.use("/api/tripsdetails", tripDetailsRoutes);
app.use("/api/tripai", tripAIRoutes);
app.use("/api/places", placesRoutes(db));  
app.use("/api/cities", citiesRoutes(db));


// Error handler
app.use((err, req, res, next) => {
  console.error("❌ Server Error:", err);
  res.status(500).json({ error: "Internal Server Error" });
});

// Start server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));
