// routes/places.js
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

  // ---- mappers to a common "place card" shape ----

  function mapAttractionToPlace(a) {
    return {
      id: a.id || slugify(a.name),
      kind: "attraction",
      place_name: a.name,
      place_type: a.category || "Attraction",
      main_theme: a.category || "",
      short_description: a.shortDescription || "",
      ideal_time: a.bestTimeToVisit || "",
      typical_visit_hours: a.recommendedDurationHours || null,
      facilities: a.activities || [],
      local_foods: (a.nearbyFoodPlaces || []).map((f) => f.name),
      imageUrl: a.image?.downloadUrl || null,
    };
  }

  function mapFoodToPlace(f) {
    return {
      id: `food-${f.id || slugify(f.name)}`,
      kind: "food",
      place_name: f.name,
      place_type: f.type || "Food",
      main_theme: "Food & restaurants",
      short_description: f.shortDescription || "",
      ideal_time: "Any time",
      typical_visit_hours: 1,
      facilities: [],
      local_foods: (f.mustTryPlaces || []).map((p) => p.name),
      imageUrl: f.image?.downloadUrl || null,
    };
  }

  function mapActivityToPlace(act) {
    return {
      id: `activity-${act.id || slugify(act.name)}`,
      kind: "activity",
      place_name: act.name,
      place_type: act.category || "Activity",
      main_theme: "Experiences & activities",
      short_description: act.shortDescription || "",
      ideal_time: act.bestTimeOfDay || "",
      typical_visit_hours: act.durationHours || null,
      facilities: [],
      local_foods: [],
      imageUrl: act.image?.downloadUrl || null,
    };
  }

  function buildPlacesFromCityDoc(cityDoc, scope, limit) {
    const data = cityDoc.data() || {};
    const attractions = Array.isArray(data.attractions) ? data.attractions : [];
    const foods = Array.isArray(data.localFoods) ? data.localFoods : [];
    const activities = Array.isArray(data.activities) ? data.activities : [];

    let arr = [];

    switch ((scope || "attractions").toLowerCase()) {
      case "food":
      case "foods":
      case "restaurants":
        arr = foods.map(mapFoodToPlace);
        break;

      case "activities":
      case "activity":
        arr = activities.map(mapActivityToPlace);
        break;

      case "all":
        arr = [
          ...attractions.map(mapAttractionToPlace),
          ...foods.map(mapFoodToPlace),
          ...activities.map(mapActivityToPlace),
        ];
        break;

      case "attractions":
      default:
        arr = attractions.map(mapAttractionToPlace);
        break;
    }

    if (limit && Number.isFinite(limit)) {
      return arr.slice(0, limit);
    }
    return arr;
  }

  // ------------------------------------------------------------------
  // GET /api/places/recommended?city=Jaipur&limit=12&scope=all
  // scope = attractions (default) | food | activities | all
  // ------------------------------------------------------------------
  router.get("/recommended", async (req, res) => {
    try {
      const rawCity = (req.query.city || "").trim();
      const limit = parseInt(req.query.limit || "12", 10);
      const scope = req.query.scope || "attractions";

      if (!rawCity) {
        return res
          .status(400)
          .json({ success: false, message: "city query is required" });
      }

      const docId = slugify(rawCity);
      const docSnap = await db.collection("cities").doc(docId).get();
      if (!docSnap.exists) {
        return res.json({ success: true, places: [] });
      }

      const places = buildPlacesFromCityDoc(docSnap, scope, limit);
      res.json({ success: true, places });
    } catch (err) {
      console.error("Recommended places error:", err);
      res
        .status(500)
        .json({ success: false, message: "Failed to load places list" });
    }
  });

  // ------------------------------------------------------------------
  // GET /api/places/search?city=Jaipur&q=paratha&limit=20&scope=all
  // ------------------------------------------------------------------
  router.get("/search", async (req, res) => {
    try {
      const rawCity = (req.query.city || "").trim();
      const q =
        (req.query.q || req.query.query || "").toString().trim().toLowerCase();
      const limit = parseInt(req.query.limit || "20", 10);
      const scope = req.query.scope || "attractions";

      if (!rawCity) {
        return res
          .status(400)
          .json({ success: false, message: "city query is required" });
      }

      const docId = slugify(rawCity);
      const docSnap = await db.collection("cities").doc(docId).get();
      if (!docSnap.exists) {
        return res.json({ success: true, places: [] });
      }

      // build all candidates according to scope
      let candidates = buildPlacesFromCityDoc(docSnap, scope, null);

      if (q) {
        candidates = candidates.filter((p) => {
          const name = (p.place_name || "").toLowerCase();
          const type = (p.place_type || "").toLowerCase();
          const desc = (p.short_description || "").toLowerCase();
          return (
            name.includes(q) ||
            type.includes(q) ||
            desc.includes(q)
          );
        });
      }

      const places = candidates.slice(0, limit);
      res.json({ success: true, places });
    } catch (err) {
      console.error("Search places error:", err);
      res
        .status(500)
        .json({ success: false, message: "Failed to search places" });
    }
  });

  return router;
};
