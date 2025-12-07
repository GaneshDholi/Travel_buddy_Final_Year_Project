// routes/trips.js
const express = require("express");
const fetch = require("node-fetch");
const admin = require("firebase-admin");
require("dotenv").config();

module.exports = (db, bucket) => {
  const router = express.Router();
  const FieldValue = admin.firestore.FieldValue;

  const UNSPLASH_KEY =
    process.env.UNSPLASH_ACCESS_KEY || "your_unsplash_key_here";

  const FALLBACK_IMG =
    "https://images.unsplash.com/photo-1507525428034-b723cf961d3e";

  // -------------------------------------------------------
  //  Helpers
  // -------------------------------------------------------
  function slugify(str) {
    return String(str || "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }

  async function authMiddleware(req, res, next) {
    try {
      const header = req.headers.authorization || "";
      const parts = header.split(" ");
      const token = parts.length === 2 ? parts[1] : null;
      if (!token) {
        return res
          .status(401)
          .json({ success: false, message: "Missing Authorization header" });
      }
      const decoded = await admin.auth().verifyIdToken(token);
      req.user = decoded;
      next();
    } catch (err) {
      console.error("verifyIdToken error:", err);
      res.status(401).json({ success: false, message: "Invalid token" });
    }
  }

  async function searchUnsplash(query) {
    try {
      const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(
        query
      )}&orientation=landscape&per_page=10&client_id=${UNSPLASH_KEY}`;
      const resp = await fetch(url);
      const json = await resp.json();
      const photo = json.results?.[0]?.urls?.regular;
      return photo || null;
    } catch (err) {
      console.error("Unsplash fetch failed:", err);
      return null;
    }
  }

  // =========================================================
  // 1. CITY IMAGES (Unsplash API)
  // =========================================================
  router.get("/city-images", async (req, res) => {
    try {
      const { city } = req.query;
      if (!city) {
        return res.status(400).json({ success: false, error: "Missing ?city parameter" });
      }

      const [hero, attractions, food, hotels] = await Promise.all([
        searchUnsplash(`${city} city skyline`),
        searchUnsplash(`${city} tourist attractions or famous place`),
        searchUnsplash(`${city} food restaurants`),
        searchUnsplash(`${city} hotel room interior`),
      ]);

      return res.json({
        success: true,
        city,
        hero: hero || FALLBACK_IMG,
        cards: {
          attractions: attractions || hero || FALLBACK_IMG,
          food: food || hero || FALLBACK_IMG,
          hotels: hotels || hero || FALLBACK_IMG,
        },
      });
    } catch (err) {
      console.error("❌ /city-images error:", err);
      return res
        .status(500)
        .json({ success: false, error: "Failed to load city images" });
    }
  });

  // =========================================================
  // 2. POPULAR CITY SUGGESTIONS (for modal dropdown)
  // =========================================================
  router.get("/city-suggestions", (req, res) => {
    const cities = [
      "Jaipur",
      "Goa",
      "Rishikesh",
      "Udaipur",
      "Manali",
      "Kerala",
      "Agra",
      "Leh",
      "Shimla",
    ];
    res.json({ success: true, cities });
  });

  // =========================================================
  // 3. IMAGE FETCHER (Firebase → Unsplash fallback)
  // =========================================================
  router.get("/image", async (req, res) => {
    try {
      const { path } = req.query;
      if (!path)
        return res
          .status(400)
          .json({ success: false, error: "Missing file path" });

      const file = bucket.file(path);
      const [exists] = await file.exists();

      if (exists) {
        const [url] = await file.getSignedUrl({
          version: "v4",
          action: "read",
          expires: Date.now() + 10 * 60 * 1000,
        });
        return res.json({ success: true, url });
      }

      const cityOrPlace = decodeURIComponent(
        path.split("/").pop().split(".")[0]
      );
      console.warn(`⚠️ File not found. Fetching Unsplash for: ${cityOrPlace}`);

      const photo =
        (await searchUnsplash(`${cityOrPlace} travel city`)) || FALLBACK_IMG;

      res.json({ success: true, url: photo });
    } catch (err) {
      console.error("❌ Error generating image URL:", err);
      res.status(500).json({
        success: false,
        error: err.message,
        fallback: FALLBACK_IMG,
      });
    }
  });

  // =========================================================
  // 4. TEMPLATE TRIPS (Recent + Popular)
  // =========================================================
  async function loadTemplateCategory(category, res) {
    try {
      if (!["recent", "popular"].includes(category))
        return res
          .status(400)
          .json({ success: false, error: "Invalid category" });

      const snapshot = await db
        .collection("trips")
        .doc("itineraries")
        .collection(category)
        .get();

      const trips = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      return res.json({ success: true, count: trips.length, trips });
    } catch (err) {
      console.error(`❌ Error fetching ${category} templates:`, err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  router.get("/recent", (req, res) => loadTemplateCategory("recent", res));
  router.get("/popular", (req, res) => loadTemplateCategory("popular", res));

  // =========================================================
  // 5. USER TRIPS (Manual / From Template)
  // =========================================================
  router.post("/", authMiddleware, async (req, res) => {
    try {
      const { title, mainCity } = req.body || {};
      if (!mainCity) {
        return res
          .status(400)
          .json({ success: false, message: "mainCity is required" });
      }

      const citySlug = slugify(mainCity);

      // ✅ validate city against Firestore "cities" collection
      const citySnap = await db.collection("cities").doc(citySlug).get();
      if (!citySnap.exists) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid city selected" });
      }

      const cityData = citySnap.data() || {};

      const tripDoc = {
        uid: req.user.uid,
        title: title || `Trip to ${cityData.name || mainCity}`,
        mainCity: cityData.name || mainCity,
        citySlug,
        country: cityData.country || "India",
        notes: "",
        itinerary: [],
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };

      const ref = await db.collection("trips").add(tripDoc);
      res.json({ success: true, tripId: ref.id });
    } catch (err) {
      console.error("Create trip error:", err);
      res.status(500).json({
        success: false,
        message: "Failed to create trip document",
      });
    }
  });


  router.post("/from-template", authMiddleware, async (req, res) => {
    try {
      const { templateCitySlug, templateIndex } = req.body || {};
      if (!templateCitySlug)
        return res
          .status(400)
          .json({ success: false, message: "templateCitySlug is required" });

      const citySlug = slugify(templateCitySlug);
      const docSnap = await db.collection("tours").doc(citySlug).get();
      if (!docSnap.exists)
        return res
          .status(404)
          .json({ success: false, message: "Template city not found" });

      const data = docSnap.data() || {};
      const its = data.itineraries || [];
      const idx = Number(templateIndex) || 0;

      if (!its[idx])
        return res
          .status(404)
          .json({ success: false, message: "Template itinerary not found" });

      const tpl = its[idx];

      const tripDoc = {
        uid: req.user.uid,
        title: tpl.title || `Trip to ${tpl.city || data.city || citySlug}`,
        mainCity: tpl.city || data.city || templateCitySlug,
        citySlug,
        country: tpl.country || data.country || "India",
        notes: tpl.description || "",
        itinerary: [
          {
            day: 1,
            label: tpl.duration || "Trip plan",
            items: [
              {
                time: "",
                type: "summary",
                title: tpl.title,
                note: tpl.description,
              },
            ],
          },
        ],
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };

      const ref = await db.collection("trips").add(tripDoc);
      res.json({ success: true, tripId: ref.id });
    } catch (err) {
      console.error("from-template error:", err);
      res.status(500).json({
        success: false,
        message: "Failed to create trip from template",
      });
    }
  });

  // =========================================================
  // 6. GET /api/trips/:tripId (load full trip)
  // =========================================================
  router.get("/:tripId", authMiddleware, async (req, res) => {
    try {
      const { tripId } = req.params;
      const tripRef = db.collection("trips").doc(tripId);
      const snap = await tripRef.get();

      if (!snap.exists)
        return res
          .status(404)
          .json({ success: false, message: "Trip not found" });

      const data = snap.data();
      if (data.uid !== req.user.uid)
        return res
          .status(403)
          .json({ success: false, message: "Not authorised to view this trip" });

      const [placesSnap, expensesSnap] = await Promise.all([
        tripRef.collection("places").orderBy("createdAt", "asc").get(),
        tripRef.collection("expenses").orderBy("createdAt", "desc").get(),
      ]);

      const places = placesSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      const expenses = expensesSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      const totalBudget = expenses.reduce(
        (sum, e) => sum + (Number(e.amount) || 0),
        0
      );

      res.json({
        success: true,
        trip: { id: tripId, ...data, places, expenses, budgetTotal: totalBudget },
      });
    } catch (err) {
      console.error("Get trip error:", err);
      res
        .status(500)
        .json({ success: false, message: "Failed to load trip details" });
    }
  });

  // =========================================================
  // 7. NOTES UPDATE
  // =========================================================
  router.put("/:tripId/notes", authMiddleware, async (req, res) => {
    try {
      const { tripId } = req.params;
      const { notes } = req.body || {};
      const tripRef = db.collection("trips").doc(tripId);
      const snap = await tripRef.get();

      if (!snap.exists)
        return res
          .status(404)
          .json({ success: false, message: "Trip not found" });

      const data = snap.data();
      if (data.uid !== req.user.uid)
        return res
          .status(403)
          .json({ success: false, message: "Not authorised to edit this trip" });

      await tripRef.update({
        notes: notes || "",
        updatedAt: FieldValue.serverTimestamp(),
      });

      res.json({ success: true });
    } catch (err) {
      console.error("Update notes error:", err);
      res
        .status(500)
        .json({ success: false, message: "Failed to update notes" });
    }
  });


  // helper: find place details either from "tours" or fallback to "cities.attractions"
  async function findPlaceDetails(db, citySlug, sourceId) {
    // 1) try tours collection (old structure)
    const toursSnap = await db.collection("tours").doc(citySlug).get();
    if (toursSnap.exists) {
      const tours = toursSnap.data() || {};
      const placesMap = tours.places || {};
      const p = placesMap[sourceId];
      if (p) {
        return {
          placeName: p.placeName,
          placeType: p.placeType,
          mainTheme: p.mainTheme || p.placeType,
          shortDescription: p.shortDescription || "",
          typicalVisitHours: p.typicalVisitHours || null,
          idealTime: p.idealTime || "",
        };
      }
    }

    // 2) fallback to cities collection (new dataset)
    const citySnap = await db.collection("cities").doc(citySlug).get();
    if (!citySnap.exists) return null;

    const data = citySnap.data() || {};
    const attractions = Array.isArray(data.attractions) ? data.attractions : [];
    const foods = Array.isArray(data.localFoods) ? data.localFoods : [];
    const activities = Array.isArray(data.activities) ? data.activities : [];

    const slugifyLocal = (str) =>
      String(str || "")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

    // a) attraction
    let at = attractions.find(
      (a) => (a.id || slugifyLocal(a.name)) === sourceId
    );
    if (at) {
      return {
        placeName: at.name,
        placeType: at.category || "Attraction",
        mainTheme: at.category || "",
        shortDescription: at.shortDescription || "",
        typicalVisitHours: at.recommendedDurationHours || null,
        idealTime: at.bestTimeToVisit || "",
      };
    }

    // b) food
    let fd = foods.find(
      (f) => `food-${f.id || slugifyLocal(f.name)}` === sourceId
    );
    if (fd) {
      return {
        placeName: fd.name,
        placeType: fd.type || "Food",
        mainTheme: "Food & restaurants",
        shortDescription: fd.shortDescription || "",
        typicalVisitHours: 1,
        idealTime: "Any time",
      };
    }

    // c) activity
    let ac = activities.find(
      (act) => `activity-${act.id || slugifyLocal(act.name)}` === sourceId
    );
    if (ac) {
      return {
        placeName: ac.name,
        placeType: ac.category || "Activity",
        mainTheme: "Experiences & activities",
        shortDescription: ac.shortDescription || "",
        typicalVisitHours: ac.durationHours || null,
        idealTime: ac.bestTimeOfDay || "",
      };
    }

    return null;
  }


  // =========================================================
  // 8. ADD PLACE
  // =========================================================
  router.post("/:tripId/places", authMiddleware, async (req, res) => {
    try {
      const { tripId } = req.params;
      const { sourceId } = req.body || {};
      if (!sourceId) {
        return res
          .status(400)
          .json({ success: false, message: "sourceId is required" });
      }

      const tripRef = db.collection("trips").doc(tripId);
      const tripSnap = await tripRef.get();

      if (!tripSnap.exists) {
        return res
          .status(404)
          .json({ success: false, message: "Trip not found" });
      }

      const trip = tripSnap.data();
      if (trip.uid !== req.user.uid) {
        return res
          .status(403)
          .json({ success: false, message: "Not authorised to edit this trip" });
      }

      const citySlug = trip.citySlug || slugify(trip.mainCity || "");

      // 🔥 new: try to find details from tours OR cities.attractions
      const p = await findPlaceDetails(db, citySlug, sourceId);
      if (!p) {
        return res.status(404).json({
          success: false,
          message: "Place not found in tours/cities data",
        });
      }

      const placeRef = tripRef.collection("places").doc(sourceId);
      await placeRef.set(
        {
          sourceCitySlug: citySlug,
          placeSlug: sourceId,
          placeName: p.placeName,
          placeType: p.placeType,
          mainTheme: p.mainTheme,
          shortDescription: p.shortDescription,
          typicalVisitHours: p.typicalVisitHours,
          idealTime: p.idealTime,
          createdAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      const placesSnap = await tripRef
        .collection("places")
        .orderBy("createdAt", "asc")
        .get();
      const places = placesSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      res.json({ success: true, places });
    } catch (err) {
      console.error("Add place error:", err);
      res
        .status(500)
        .json({ success: false, message: "Failed to add place to trip" });
    }
  });


  // =========================================================
  // 9. ADD EXPENSE
  // =========================================================
  router.post("/:tripId/expenses", authMiddleware, async (req, res) => {
    try {
      const { tripId } = req.params;
      const { label, amount, currency, category } = req.body || {};
      const numericAmount = Number(amount);

      if (!label || isNaN(numericAmount))
        return res
          .status(400)
          .json({
            success: false,
            message: "label and numeric amount are required",
          });

      const tripRef = db.collection("trips").doc(tripId);
      const snap = await tripRef.get();
      if (!snap.exists)
        return res
          .status(404)
          .json({ success: false, message: "Trip not found" });

      const data = snap.data();
      if (data.uid !== req.user.uid)
        return res
          .status(403)
          .json({ success: false, message: "Not authorised to edit this trip" });

      await tripRef.collection("expenses").add({
        label,
        amount: numericAmount,
        currency: currency || "INR",
        category: category || "General",
        createdAt: FieldValue.serverTimestamp(),
      });

      const expensesSnap = await tripRef
        .collection("expenses")
        .orderBy("createdAt", "desc")
        .get();

      const expenses = expensesSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      const totalBudget = expenses.reduce(
        (sum, e) => sum + (Number(e.amount) || 0),
        0
      );

      res.json({ success: true, expenses, totalBudget });
    } catch (err) {
      console.error("Add expense error:", err);
      res
        .status(500)
        .json({ success: false, message: "Failed to add expense" });
    }
  });

  return router;
};
