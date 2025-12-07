// routes/cities.js
const express = require("express");

module.exports = (db) => {
  const router = express.Router();

  function slugify(str) {
    return String(str || "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }

  /**
   * GET /api/cities
   * → For “Plan a trip” dropdown & explore grid
   * Returns all cities from Firestore "cities" collection.
   */
  router.get("/", async (req, res) => {
    try {
      const snap = await db.collection("cities").get();

      const cities = snap.docs.map((doc) => {
        const d = doc.data() || {};
        return {
          id: doc.id,                          // e.g. jaipur
          name: d.name || doc.id,              // Jaipur
          state: d.state || null,
          country: d.country || "India",
          shortNotes: d.shortNotes || "",
          bestSeason: d.bestSeason || "",
          idealTripDays: d.idealTripDays || null,
          budget: d.budget || null,
          // cover image comes from seeder: data.coverImage.downloadUrl
          coverImageUrl: d.coverImage?.downloadUrl || null,
        };
      });

      res.json({ success: true, cities });
    } catch (err) {
      console.error("GET /api/cities error:", err);
      res.status(500).json({ success: false, message: "Failed to load cities" });
    }
  });

  /**
   * GET /api/cities/:cityId/attractions?limit=20
   * → For “Plan a trip → choose city → show attractions”.
   * Reads from cities/{cityId}.attractions (dataset you generated).
   */
  router.get("/:cityId/attractions", async (req, res) => {
    try {
      const { cityId } = req.params;
      const limit = parseInt(req.query.limit || "20", 10);

      const docSnap = await db.collection("cities").doc(cityId).get();
      if (!docSnap.exists) {
        return res.status(404).json({ success: false, message: "City not found" });
      }

      const data = docSnap.data() || {};
      const attractions = Array.isArray(data.attractions) ? data.attractions : [];

      const places = attractions.slice(0, limit).map((a) => ({
        id: a.id || slugify(a.name),
        name: a.name,
        category: a.category,
        shortDescription: a.shortDescription,
        cityArea: a.cityArea || null,
        fullAddress: a.fullAddress || null,
        latitude: a.latitude ?? null,
        longitude: a.longitude ?? null,
        approxTicketPriceInr: a.approxTicketPriceInr ?? null,
        recommendedDurationHours: a.recommendedDurationHours ?? null,
        bestTimeToVisit: a.bestTimeToVisit || "",
        imageUrl: a.image?.downloadUrl || null, // 🔥 your fixed Storage image
        // you can also return nearbyFoodPlaces / activities if FE needs
      }));

      res.json({ success: true, places });
    } catch (err) {
      console.error("GET /api/cities/:cityId/attractions error:", err);
      res.status(500).json({ success: false, message: "Failed to load attractions" });
    }
  });

  return router;
};
