// planTrip.js
// Frontend logic JUST for planTrip.html

document.addEventListener("DOMContentLoaded", () => {
  const backendBase = "http://localhost:4000";

  const hasFirebase =
    !!window.firebase && typeof window.firebase.auth === "function";
  const auth = hasFirebase ? firebase.auth() : null;

  const exploreGrid = document.getElementById("exploreGrid");
  const recCardsEl = document.getElementById("recCards");
  const tripTitleEl = document.getElementById("tripTitle");
  const notesBox = document.querySelector(".notes-box");
  const expensesListEl = document.getElementById("expensesList");
  const budgetTotalEl = document.querySelector(".budget-total");
  const btnAddExpense = document.getElementById("btn-add-expense");
  const heroImgEl = document.querySelector(".hero-img");
  const datesEl = document.querySelector(".dates");
  const placeSearchInput = document.getElementById("place-search-input");

  // hero avatars
  const heroOwnerAvatar = document.getElementById("hero-owner-avatar");
  const collabAvatarsEl = document.getElementById("collab-avatars");

  // Modals
  const cityModal = document.getElementById("city-modal");
  const cityInput = document.getElementById("city-input");
  const cityConfirmBtn = document.getElementById("city-confirm-btn");
  const cityCancelBtn = document.getElementById("city-cancel-btn");

  const durationModal = document.getElementById("duration-modal");
  const durationSelect = document.getElementById("trip-duration");
  const durationSaveBtn = document.getElementById("duration-save-btn");
  const durationSkipBtn = document.getElementById("duration-skip-btn");

  const datesModal = document.getElementById("dates-modal");
  const startDateInput = document.getElementById("start-date");
  const endDateInput = document.getElementById("end-date");
  const datesSummaryEl = document.getElementById("dates-summary");
  const datesSaveBtn = document.getElementById("dates-save-btn");
  const datesCancelBtn = document.getElementById("dates-cancel-btn");

  const membersModal = document.getElementById("members-modal");
  const inviteEmailInput = document.getElementById("invite-email");
  const inviteMsgInput = document.getElementById("invite-message");
  const inviteResultEl = document.getElementById("invite-result");
  const membersCancelBtn = document.getElementById("members-cancel-btn");
  const membersSendBtn = document.getElementById("members-send-btn");
  const addMemberBtn = document.getElementById("btn-add-member");

  const notesMenuBtn = document.getElementById("notes-menu-btn");
  const notesMenu = document.getElementById("notes-menu");

  const resItems = document.querySelectorAll(".res-item");

  const reservationModal = document.getElementById("reservation-modal");
  const reservationCategoryInput = document.getElementById("reservation-category");
  const reservationTitleInput = document.getElementById("reservation-title");
  const reservationAmountInput = document.getElementById("reservation-amount");
  const reservationDateInput = document.getElementById("reservation-date");
  const reservationNotesInput = document.getElementById("reservation-notes");
  const reservationForm = document.getElementById("reservation-form");
  const reservationCancelBtn = document.getElementById("reservation-cancel-btn");
  const reservationCloseBtn = document.getElementById("reservation-close-btn");

  // extra list UI
  const extraTitleInput = document.getElementById("extra-list-title");
  const extraSearchInput = document.getElementById("extra-place-search");
  const extraRecommendedEl = document.getElementById("extra-recommended-list");
  const extraSelectedEl = document.getElementById("extra-selected-list");

  let reservationCategory = null;

  let extraListScope = "all";        // attractions | food | activities | all
  let extraSelectedPlaces = [];      // local UI list only
  let currentTripId = null;
  let currentCity = null;
  let collaborators = [];

  // cities for suggestions
  let allCities = [];
  let selectedCityName = null;

  // places & itinerary
  let selectedPlaces = []; // { id, name }
  let recommendedPlacesCache = []; // last list rendered to recCardsEl

  // Same slug logic as backend (Ajmer -> ajmer, "New Delhi" -> "new-delhi")
  function slugify(str) {
    return String(str || "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }

  // ---------- Extra custom list (e.g. "Restaurants") ----------

  function inferExtraScopeFromTitle(title) {
    const t = (title || "").toLowerCase();
    if (!t) return "all";
    if (t.includes("restaurant") || t.includes("food") || t.includes("eat")) return "food";
    if (t.includes("activity") || t.includes("things to do")) return "activities";
    if (t.includes("temple") || t.includes("sight") || t.includes("attraction")) return "attractions";
    return "all";
  }

  function renderExtraSelected() {
    if (!extraSelectedEl) return;

    if (!extraSelectedPlaces.length) {
      extraSelectedEl.innerHTML = `<div class="muted">No places saved yet.</div>`;
      return;
    }

    extraSelectedEl.innerHTML = extraSelectedPlaces
      .map(
        (p) => `
      <div class="extra-place added" data-id="${p.id}">
        <div class="extra-place-main">
          <div class="extra-place-name">${p.place_name}</div>
          <div class="extra-place-type">${p.place_type || ""}</div>
          ${p.short_description
            ? `<div class="extra-place-desc">${p.short_description}</div>`
            : ""
          }
        </div>
        <button class="extra-add-btn" disabled>Added</button>
      </div>
    `
      )
      .join("");
  }

  function renderExtraRecommended(places = []) {
    if (!extraRecommendedEl) return;

    if (!places.length) {
      extraRecommendedEl.innerHTML =
        `<div class="muted">No recommended places for this list yet.</div>`;
      return;
    }

    extraRecommendedEl.innerHTML = places
      .map((p) => {
        const already = extraSelectedPlaces.some((sp) => sp.id === p.id);
        return `
        <div class="extra-place ${already ? "added" : ""}" data-id="${p.id}">
          <div class="extra-place-main">
            <div class="extra-place-name">${p.place_name}</div>
            <div class="extra-place-type">${p.place_type || ""}</div>
            ${p.short_description
            ? `<div class="extra-place-desc">${p.short_description}</div>`
            : ""
          }
          </div>
          <button class="extra-add-btn" data-id="${p.id}">
            ${already ? "Added" : "+ Add"}
          </button>
        </div>
      `;
      })
      .join("");
  }

  async function loadExtraRecommended() {
    if (!extraRecommendedEl || !currentCity) return;

    try {
      extraRecommendedEl.innerHTML = `<div class="muted">Loading places...</div>`;

      const res = await fetch(
        `${backendBase}/api/places/recommended?city=${encodeURIComponent(
          currentCity
        )}&scope=${encodeURIComponent(extraListScope)}&limit=10`
      );
      const json = await res.json();
      if (!json.success || !Array.isArray(json.places)) {
        extraRecommendedEl.innerHTML =
          `<div class="muted">No recommended places found.</div>`;
        return;
      }

      renderExtraRecommended(json.places);
    } catch (err) {
      console.error("Extra list load failed:", err);
      extraRecommendedEl.innerHTML =
        `<div style="color:red">Failed to load places.</div>`;
    }
  }

  function setupExtraList() {
    if (!extraTitleInput || !extraRecommendedEl) return;

    // scope depends on the list title
    extraTitleInput.addEventListener("input", () => {
      extraListScope = inferExtraScopeFromTitle(extraTitleInput.value || "");
      // reload when the user changes title
      loadExtraRecommended();
    });

    // search within extra list
    if (extraSearchInput) {
      extraSearchInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          const q = extraSearchInput.value.trim();
          if (!q) {
            loadExtraRecommended();
            return;
          }
          searchExtraPlaces(q);
        }
      });
    }

    // handle + Add clicks
    extraRecommendedEl.addEventListener("click", (e) => {
      const btn = e.target.closest(".extra-add-btn");
      if (!btn) return;

      const placeId = btn.getAttribute("data-id");
      const row = btn.closest(".extra-place");
      if (!placeId || !row) return;

      // find full place object from last recommended list render
      const place = (recommendedPlacesCache || []).find((p) => p.id === placeId);
      if (!place) return;

      if (!extraSelectedPlaces.some((p) => p.id === place.id)) {
        extraSelectedPlaces.push(place);
        // optional: also attach to main trip
        addPlaceToTrip(place.id, place.place_name);
      }

      renderExtraRecommended(recommendedPlacesCache);
      renderExtraSelected();
    });
  }

  async function searchExtraPlaces(query) {
    if (!currentCity || !extraRecommendedEl) return;
    extraRecommendedEl.innerHTML = `<div class="muted">Searching...</div>`;
    try {
      const res = await fetch(
        `${backendBase}/api/places/search?city=${encodeURIComponent(
          currentCity
        )}&q=${encodeURIComponent(query)}&limit=20`
      );
      const json = await res.json();
      if (!json.success || !Array.isArray(json.places) || !json.places.length) {
        extraRecommendedEl.innerHTML =
          `<div class="muted">No places found for this search.</div>`;
        return;
      }
      renderExtraRecommended(json.places);
    } catch (err) {
      console.error("Extra search failed:", err);
      extraRecommendedEl.innerHTML =
        `<div style="color:red">Search failed, please try again.</div>`;
    }
  }

  // ---------- Storage keys ----------

  function datesStorageKey() {
    if (!currentTripId) return null;
    return `tripDates_${currentTripId}`;
  }

  function durationStorageKey() {
    if (!currentTripId) return null;
    return `tripDuration_${currentTripId}`;
  }

  function membersStorageKey() {
    if (!currentTripId) return null;
    return `tripMembers_${currentTripId}`;
  }

  function placesStorageKey() {
    if (!currentTripId) return null;
    return `tripPlaces_${currentTripId}`;
  }

  function itineraryStorageKey() {
    if (!currentTripId) return null;
    return `tripItinerary_${currentTripId}`;
  }

  // ---------- Helpers ----------

  function getCityFromUrlOrTitle() {
    const params = new URLSearchParams(window.location.search);
    if (params.get("city")) {
      return params.get("city");
    }

    if (tripTitleEl) {
      const text = tripTitleEl.textContent || "";
      const match = text.match(/Trip to (.+)/i);
      if (match) return match[1].trim();
      return text.trim();
    }

    return "Jaipur"; // safe default
  }

  async function getIdTokenIfLoggedIn() {
    if (!hasFirebase) return null;

    return new Promise((resolve) => {
      const current = auth.currentUser;
      if (current) {
        current.getIdToken().then(resolve).catch(() => resolve(null));
        return;
      }
      auth.onAuthStateChanged((user) => {
        if (!user) return resolve(null);
        user.getIdToken().then(resolve).catch(() => resolve(null));
      });
    });
  }

  async function ensureTripForCity(city) {
    const uid = localStorage.getItem("uid");
    if (!uid) return null;

    const storageKey = `trip_${uid}_${city}`;
    const existingTripId = localStorage.getItem(storageKey);
    const idToken = await getIdTokenIfLoggedIn();
    if (!idToken) return null;

    if (existingTripId) {
      return { tripId: existingTripId, storageKey };
    }

    const body = {
      title: `Trip to ${city}`,
      mainCity: city,
      country: "India",
    };

    const res = await fetch(`${backendBase}/api/trips`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify(body),
    });

    const json = await res.json();
    if (!json.success) {
      throw new Error(json.message || "Failed to create trip");
    }

    localStorage.setItem(storageKey, json.tripId);
    return { tripId: json.tripId, storageKey };
  }

  async function fetchTrip(tripId) {
    const idToken = await getIdTokenIfLoggedIn();
    if (!idToken) return null;

    const res = await fetch(`${backendBase}/api/trips/${tripId}`, {
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    });

    const json = await res.json();
    if (!json.success) {
      throw new Error(json.message || "Failed to load trip");
    }
    return json.trip;
  }

  async function addPlaceToTrip(placeId, placeName) {
    try {
      if (!currentCity) {
        currentCity = getCityFromUrlOrTitle();
      }

      if (!currentTripId) {
        const tripInfo = await ensureTripForCity(currentCity);
        if (!tripInfo) {
          alert("Please login first to save places in your trip.");
          return;
        }
        currentTripId = tripInfo.tripId;
      }

      const idToken = await getIdTokenIfLoggedIn();
      if (!idToken) {
        alert("Please login first to save places in your trip.");
        return;
      }

      const res = await fetch(
        `${backendBase}/api/trips/${currentTripId}/places`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            sourceId: placeId,
            placeId: placeId,
          }),
        }
      );

      const json = await res.json();
      if (!json.success) {
        throw new Error(json.message || "Failed to add place");
      }

      // optional toast
      console.log(`✅ ${placeName} added to your trip!`);
    } catch (err) {
      console.error("Error adding place to trip:", err);
      alert("Could not add place, please try again.");
    }
  }

  function renderExploreTextCards(city) {
    if (!exploreGrid) return;

    const exploreData = [
      {
        title: `Best attractions in ${city}`,
        sub: "Most searched sights and landmarks",
      },
      {
        title: `Best food in ${city}`,
        sub: "Local dishes and famous spots",
      },
      {
        title: "Search hotels with transparent pricing",
        sub: "Unlike most sites, we don't sort based on commissions",
      },
    ];

    exploreGrid.innerHTML = exploreData
      .map(
        (item) => `
      <div class="exp-card">
        <div class="exp-title">${item.title}</div>
        <div class="exp-sub">${item.sub}</div>
      </div>
    `
      )
      .join("");
  }

  async function loadCitySuggestionsFromBackend() {
    const suggestionsBox = document.getElementById("city-suggestions");
    if (!suggestionsBox) return;

    // Already loaded once → don't reload
    if (allCities.length > 0) {
      suggestionsBox.classList.remove("hidden");
      return;
    }

    try {
      const res = await fetch(`${backendBase}/api/cities`);
      const json = await res.json();

      if (!json.success || !Array.isArray(json.cities) || json.cities.length === 0) {
        console.warn("No cities returned from backend /api/cities");
        return;
      }

      allCities = json.cities.sort((a, b) =>
        a.name.localeCompare(b.name, "en-IN")
      );

      suggestionsBox.innerHTML = allCities
        .map(
          (c) => `
          <div class="city-suggestion" data-id="${c.id}" data-name="${c.name}">
            ${c.name}${c.state ? `, <span class="muted">${c.state}</span>` : ""}
          </div>
        `
        )
        .join("");

      suggestionsBox.classList.remove("hidden");

      suggestionsBox.querySelectorAll(".city-suggestion").forEach((item) => {
        item.addEventListener("click", () => {
          selectedCityName = item.dataset.name;
          if (cityInput) {
            cityInput.value = selectedCityName;
          }
          suggestionsBox.classList.add("hidden");
        });
      });
    } catch (err) {
      console.error("Failed to load city suggestions:", err);
    }
  }

  // ---------- City images ----------

  async function loadCityImages(city) {
    if (!exploreGrid && !heroImgEl) return;

    try {
      // Ensure city list
      if (allCities.length === 0) {
        const resCities = await fetch(`${backendBase}/api/cities`);
        const jsonCities = await resCities.json();
        if (jsonCities.success && Array.isArray(jsonCities.cities)) {
          allCities = jsonCities.cities;
        }
      }

      const cityObj =
        allCities.find((c) => c.name.toLowerCase() === city.toLowerCase()) ||
        null;

      const cityId = cityObj?.id || slugify(city);
      const coverUrl = cityObj?.coverImageUrl || null;

      // sample attraction image
      let attractionImg = null;
      try {
        const resAttr = await fetch(
          `${backendBase}/api/cities/${encodeURIComponent(
            cityId
          )}/attractions?limit=1`
        );
        const jsonAttr = await resAttr.json();
        if (
          jsonAttr.success &&
          Array.isArray(jsonAttr.places) &&
          jsonAttr.places.length
        ) {
          attractionImg = jsonAttr.places[0].imageUrl || null;
        }
      } catch (err) {
        console.warn("Failed to load sample attraction image:", err);
      }

      const hero = coverUrl || attractionImg || null;
      const attractionsImg = attractionImg || coverUrl || hero;
      const restaurantsImg = attractionImg || coverUrl || hero;
      const hotelsImg = coverUrl || hero; // can change later

      if (heroImgEl && hero) {
        heroImgEl.src = hero;
      }

      if (exploreGrid) {
        const cards = [
          {
            title: `Best attractions in ${city}`,
            sub: "Most searched sights and landmarks",
            img: attractionsImg || hero,
          },
          {
            title: `Best restaurants in ${city}`,
            sub: "Local dishes and famous spots",
            img: restaurantsImg || hero,
          },
          {
            title: "Search hotels with transparent pricing",
            sub: "Unlike most sites, we don't sort based on commissions",
            img: hotelsImg || hero,
          },
        ];

        exploreGrid.innerHTML = cards
          .map(
            (item) => `
          <div class="exp-card">
            <img src="${item.img}" alt="${item.title}">
            <div class="exp-title">${item.title}</div>
            <div class="exp-sub">${item.sub}</div>
          </div>
        `
          )
          .join("");
      }
    } catch (err) {
      console.error("Failed to load city images from dataset:", err);
      renderExploreTextCards(city);
    }
  }

  // ---------- Recommended / searched places ----------

  function renderPlacesList(places) {
    if (!recCardsEl) return;

    recommendedPlacesCache = Array.isArray(places) ? places : [];

    if (!recommendedPlacesCache.length) {
      recCardsEl.innerHTML =
        '<p class="muted">No recommended places for this city yet.</p>';
      return;
    }

    recCardsEl.innerHTML = recommendedPlacesCache
      .map((p) => {
        const id = p.id;
        const isSelected = selectedPlaces.some((sp) => sp.id === id);
        const img = p.imageUrl || "./assets/place-placeholder.jpg";
        const type = p.place_type || "";
        const theme = p.main_theme || "";
        return `
        <div class="rec-card ${isSelected ? "selected" : ""}" data-place-id="${id}">
          <img src="${img}" alt="${p.place_name}">
          <div class="rec-name">
            <div>${p.place_name}</div>
            <div class="muted" style="font-size:12px;">${type}${theme ? " · " + theme : ""
          }</div>
          </div>
          <button class="rec-plus" data-name="${p.place_name}">
            ${isSelected ? "✓" : "+"}
          </button>
        </div>
      `;
      })
      .join("");

    recCardsEl.querySelectorAll(".rec-plus").forEach((btn) => {
      btn.addEventListener("click", () => {
        const card = btn.closest(".rec-card");
        const placeId = card.dataset.placeId;
        const placeName = btn.getAttribute("data-name");
        togglePlaceSelection(placeId, placeName);
      });
    });
  }

  async function renderRecommendedPlaces(city) {
    if (!recCardsEl) return;

    try {
      recCardsEl.innerHTML = '<p class="muted">Loading places...</p>';

      const res = await fetch(
        `${backendBase}/api/places/recommended?city=${encodeURIComponent(
          city
        )}&limit=12`
      );
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.message || "Failed to fetch");
      }

      if (!json.places || !json.places.length) {
        recCardsEl.innerHTML =
          '<p class="muted">No recommended places found for this city yet.</p>';
        return;
      }

      renderPlacesList(json.places);
    } catch (err) {
      console.error("Error loading recommended places:", err);
      recCardsEl.innerHTML =
        "<p style='color:red'>Failed to load recommended places.</p>";
    }
  }

  async function searchPlaces(query) {
    if (!recCardsEl || !currentCity) return;
    if (!query.trim()) {
      // go back to recommended
      renderRecommendedPlaces(currentCity);
      return;
    }

    recCardsEl.innerHTML = '<p class="muted">Searching...</p>';

    try {
      const res = await fetch(
        `${backendBase}/api/places/search?city=${encodeURIComponent(
          currentCity
        )}&q=${encodeURIComponent(query)}&query=${encodeURIComponent(
          query
        )}&limit=20`
      );
      const json = await res.json();
      if (!json.success || !Array.isArray(json.places) || !json.places.length) {
        recCardsEl.innerHTML =
          '<p class="muted">No places found for this search.</p>';
        return;
      }
      renderPlacesList(json.places);
    } catch (err) {
      console.error("Search failed:", err);
      recCardsEl.innerHTML =
        "<p style='color:red'>Search failed, please try again.</p>";
    }
  }

  // ---------- Selected places storage ----------

  function saveSelectedPlacesToStorage() {
    const key = placesStorageKey();
    if (!key) return;
    try {
      localStorage.setItem(key, JSON.stringify(selectedPlaces || []));
    } catch (err) {
      console.warn("Failed to save selected places:", err);
    }
  }

  function loadSelectedPlacesFromStorage() {
    const key = placesStorageKey();
    selectedPlaces = [];
    if (!key) return;

    try {
      const arr = JSON.parse(localStorage.getItem(key) || "[]");
      if (Array.isArray(arr)) {
        selectedPlaces = arr
          .filter((p) => p && p.id && p.name)
          .map((p) => ({ id: p.id, name: p.name }));
      }
    } catch (err) {
      console.warn("Failed to load selected places:", err);
      selectedPlaces = [];
    }
  }

  function togglePlaceSelection(placeId, placeName) {
    if (!placeId) return;

    const idx = selectedPlaces.findIndex((p) => p.id === placeId);
    if (idx >= 0) {
      selectedPlaces.splice(idx, 1);
    } else {
      selectedPlaces.push({ id: placeId, name: placeName });
      // also attach to trip in backend (fire and forget)
      addPlaceToTrip(placeId, placeName);
    }

    saveSelectedPlacesToStorage();
    renderPlacesList(recommendedPlacesCache);
    rebuildItineraryFromSelectedPlaces();
  }

  // ---------- Extra list (“Add a title e.g. Restaurants”) ----------

  // local cache for extra recommended places
  let extraRecommendedCache = [];

  function inferScopeFromTitle(title) {
    const t = (title || "").toLowerCase();

    const foodWords = [
      "food",
      "restaurant",
      "restaurants",
      "cafe",
      "cafes",
      "street food",
      "breakfast",
      "lunch",
      "dinner",
      "coffee",
    ];
    const activityWords = [
      "activity",
      "activities",
      "things to do",
      "adventure",
      "trek",
      "rafting",
      "sports",
      "experiences",
    ];

    if (foodWords.some((w) => t.includes(w))) return "food";
    if (activityWords.some((w) => t.includes(w))) return "activities";
    return "all";
  }

  // render the bottom "Saved in this list" chips
  function renderExtraSelectedPlaces() {
    if (!extraSelectedEl) return;

    if (!extraSelectedPlaces.length) {
      extraSelectedEl.innerHTML =
        '<p class="muted">No places saved yet.</p>';
      return;
    }

    extraSelectedEl.innerHTML = extraSelectedPlaces
      .map(
        (p) => `
        <span class="extra-saved-item">${p.name}</span>
      `
      )
      .join("");
  }

  // render recommended places as horizontal cards (same UI as top section)
  function renderExtraRecommendedPlaces(places = []) {
    if (!extraRecommendedEl) return;

    extraRecommendedCache = Array.isArray(places) ? places : [];

    // make sure it uses the same flex row styling
    extraRecommendedEl.classList.add("rec-cards");

    if (!extraRecommendedCache.length) {
      extraRecommendedEl.innerHTML =
        '<p class="muted">No recommended places for this list.</p>';
      return;
    }

    extraRecommendedEl.innerHTML = extraRecommendedCache
      .map((p) => {
        const id = p.id;
        const already = extraSelectedPlaces.some((sp) => sp.id === id);
        const img = p.imageUrl || "./assets/place-placeholder.jpg";
        const type = p.place_type || "";
        const theme = p.main_theme || "";
        return `
        <div class="rec-card ${already ? "selected" : ""}" data-extra-place-id="${id}">
          <img src="${img}" alt="${p.place_name}">
          <div class="rec-name">
            <div>${p.place_name}</div>
            <div class="muted" style="font-size:12px;">
              ${type}${theme ? " · " + theme : ""}
            </div>
          </div>
          <button
            class="rec-plus"
            data-id="${id}"
            data-name="${p.place_name}"
            ${already ? "disabled" : ""}
          >
            ${already ? "✓" : "+"}
          </button>
        </div>
      `;
      })
      .join("");

    // wire up + / ✓ buttons
    extraRecommendedEl.querySelectorAll(".rec-plus").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-id");
        const name = btn.getAttribute("data-name");
        if (!id || !name || btn.disabled) return;

        // same backend call as before
        await addPlaceToTrip(id, name);

        if (!extraSelectedPlaces.some((p) => p.id === id)) {
          extraSelectedPlaces.push({ id, name });
        }

        renderExtraSelectedPlaces();
        renderExtraRecommendedPlaces(extraRecommendedCache);
      });
    });
  }

  async function loadExtraRecommendedPlaces() {
    if (!extraRecommendedEl) return;

    const cityName = currentCity || getCityFromUrlOrTitle();
    if (!cityName) return;

    extraRecommendedEl.innerHTML = '<p class="muted">Loading places...</p>';

    try {
      const url =
        `${backendBase}/api/places/recommended?` +
        new URLSearchParams({
          city: cityName,
          scope: extraListScope,
          limit: "12",
        }).toString();

      const res = await fetch(url);
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.message || "Failed to load places list");
      }

      renderExtraRecommendedPlaces(json.places || []);
    } catch (err) {
      console.error("Extra recommended error:", err);
      extraRecommendedEl.innerHTML =
        "<p style='color:red'>Failed to load places.</p>";
    }
  }

  async function searchExtraPlaces(query) {
    if (!extraRecommendedEl) return;
    const q = (query || "").trim();
    if (!q) {
      loadExtraRecommendedPlaces();
      return;
    }

    const cityName = currentCity || getCityFromUrlOrTitle();
    if (!cityName) return;

    extraRecommendedEl.innerHTML = '<p class="muted">Searching...</p>';

    try {
      const url =
        `${backendBase}/api/places/search?` +
        new URLSearchParams({
          city: cityName,
          q,
          scope: extraListScope,
          limit: "20",
        }).toString();

      const res = await fetch(url);
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.message || "Search failed");
      }
      const places = Array.isArray(json.places) ? json.places : [];
      if (!places.length) {
        extraRecommendedEl.innerHTML =
          '<p class="muted">No places found for this search.</p>';
        return;
      }
      renderExtraRecommendedPlaces(places);
    } catch (err) {
      console.error("Search extra places failed:", err);
      extraRecommendedEl.innerHTML =
        "<p style='color:red'>Search failed, please try again.</p>";
    }
  }

  function attachExtraListInteractions() {
    // title → infer scope (food / activities / all)
    if (extraTitleInput) {
      extraTitleInput.addEventListener("blur", () => {
        extraListScope = inferScopeFromTitle(extraTitleInput.value || "");
        loadExtraRecommendedPlaces();
      });

      extraTitleInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          extraListScope = inferScopeFromTitle(extraTitleInput.value || "");
          loadExtraRecommendedPlaces();
        }
      });
    }

    // search box
    if (extraSearchInput) {
      extraSearchInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          searchExtraPlaces(extraSearchInput.value || "");
        }
      });
    }
  }


  // ---------- Budget / expenses ----------

  function attachBudgetInteractions() {
    // Mini "View details" → scroll to big budget section
    const bmLink = document.querySelector(".bm-link");
    const budgetSection = document.getElementById("budgetSection");
    if (bmLink && budgetSection) {
      bmLink.addEventListener("click", () => {
        budgetSection.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }

    // Group balances button → basic placeholder for now
    const btnGroupBalances = document.getElementById("btn-group-balances");
    if (btnGroupBalances) {
      btnGroupBalances.addEventListener("click", () => {
        alert("Group balances feature coming soon. For now, all expenses are shared equally.");
      });
    }

    // Big budget links: View breakdown / Add tripmate / Settings
    const budgetLinks = document.querySelectorAll(".budget-link");
    budgetLinks.forEach((link) => {
      const text = (link.textContent || "").trim();

      if (text.includes("View breakdown")) {
        // Show simple breakdown by category from local data
        link.addEventListener("click", () => {
          if (!currentTripId) {
            alert("Start a trip first to see budget breakdown.");
            return;
          }
          const key = `tripBudget_${currentTripId}`;
          let data = null;
          try {
            data = JSON.parse(localStorage.getItem(key) || "null");
          } catch { }
          if (!data || !Array.isArray(data.expenses) || !data.expenses.length) {
            alert("No expenses added yet.");
            return;
          }

          const byCat = {};
          data.expenses.forEach((e) => {
            const cat = e.category || "Uncategorized";
            const amt = Number(e.amount) || 0;
            byCat[cat] = (byCat[cat] || 0) + amt;
          });

          let msg = "Expense breakdown:\n\n";
          Object.keys(byCat).forEach((cat) => {
            msg += `${cat}: ₹${byCat[cat].toFixed(2)}\n`;
          });
          msg += `\nTotal: ₹${(data.total || 0).toFixed(2)}`;
          alert(msg);
        });
      } else if (text.includes("Add tripmate")) {
        // Reuse the same members-modal from top hero
        link.addEventListener("click", () => {
          if (!currentTripId) {
            alert("Start a trip first by choosing a city.");
            return;
          }
          if (!membersModal) {
            alert("Members modal not available.");
            return;
          }
          inviteEmailInput.value = "";
          inviteMsgInput.value = "";
          inviteResultEl.textContent = "";
          membersModal.classList.remove("hidden");
        });
      } else if (text.includes("Settings")) {
        // simple placeholder
        link.addEventListener("click", () => {
          alert("Budget settings coming soon 🙂");
        });
      }
    });
  }

  function renderExpenses(expenses = [], total = 0) {
    if (!expensesListEl) return;

    if (!expenses.length) {
      expensesListEl.textContent = "You haven't added any expenses yet.";
    } else {
      expensesListEl.innerHTML = expenses
        .map(
          (e) => `
        <div>
          ₹${e.amount} · ${e.label}${e.category ? ` <span class="muted">(${e.category})</span>` : ""
            }
        </div>
      `
        )
        .join("");
    }

    if (budgetTotalEl) {
      const formatted = `₹${total.toFixed(2)}`;
      budgetTotalEl.textContent = formatted;
      const mini = document.querySelector(".bm-amt");
      if (mini) mini.textContent = formatted;
    }
  }

  function saveBudgetToLocal(expenses, total) {
    if (!currentTripId) return;
    const key = `tripBudget_${currentTripId}`;
    localStorage.setItem(
      key,
      JSON.stringify({ expenses: expenses || [], total: total || 0 })
    );
  }

  function loadBudgetFromLocal() {
    if (!currentTripId) return null;
    const key = `tripBudget_${currentTripId}`;
    try {
      const data = JSON.parse(localStorage.getItem(key) || "null");
      if (data && Array.isArray(data.expenses)) {
        renderExpenses(data.expenses, data.total || 0);
        return data;
      }
    } catch {
      /* ignore */
    }
    return null;
  }

  async function addExpenseFlow(categoryLabel) {
    try {
      if (!currentTripId) {
        alert("Create or load a trip first (login required).");
        return;
      }

      const label =
        prompt(
          `Expense for? (category: ${categoryLabel})`,
          categoryLabel || "Custom"
        ) || "";
      if (!label.trim()) return;

      const amountStr = prompt("Amount in ₹");
      const amount = parseFloat(amountStr || "0");
      if (!amount || isNaN(amount)) {
        alert("Please enter a valid amount.");
        return;
      }

      const idToken = await getIdTokenIfLoggedIn();
      if (!idToken) {
        alert("Please login first.");
        return;
      }

      const res = await fetch(
        `${backendBase}/api/trips/${currentTripId}/expenses`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            label,
            amount,
            currency: "INR",
            category: categoryLabel,
          }),
        }
      );

      const json = await res.json();
      if (!json.success) {
        throw new Error(json.message || "Failed to add expense");
      }

      // backend returns {expenses,totalBudget}
      const exp = json.expenses || [];
      const total = json.totalBudget || 0;
      renderExpenses(exp, total);
      saveBudgetToLocal(exp, total);
    } catch (err) {
      console.error("Add expense failed:", err);
      alert("Could not add expense, please try again.");
    }
  }

  function attachAddExpense() {
    if (!btnAddExpense) return;

    btnAddExpense.addEventListener("click", () => addExpenseFlow("Custom"));
  }

  function attachReservationModal() {
    if (!reservationModal || !resItems.length) return;

    // open modal when clicking any reservation icon
    resItems.forEach((item) => {
      item.addEventListener("click", () => {
        if (!currentTripId) {
          alert("Start a trip first by choosing a city.");
          return;
        }

        reservationCategory = item.dataset.expenseCategory || "Other";
        if (reservationCategoryInput) {
          reservationCategoryInput.value = reservationCategory;
        }

        // small default titles
        if (reservationTitleInput) {
          reservationTitleInput.value = "";
          reservationTitleInput.placeholder =
            reservationCategory === "Flight"
              ? "e.g. Indigo 6E-1234"
              : reservationCategory === "Lodging"
                ? "e.g. Zostel, 2 nights"
                : reservationCategory === "Rental car"
                  ? "e.g. Zoomcar 1 day"
                  : reservationCategory === "Restaurant"
                    ? "e.g. Dinner at XYZ"
                    : "";
        }

        if (reservationAmountInput) reservationAmountInput.value = "";
        if (reservationDateInput) reservationDateInput.value = "";
        if (reservationNotesInput) reservationNotesInput.value = "";

        reservationModal.classList.remove("hidden");
      });
    });

    function closeReservationModal() {
      reservationModal.classList.add("hidden");
    }

    if (reservationCancelBtn) {
      reservationCancelBtn.addEventListener("click", closeReservationModal);
    }
    if (reservationCloseBtn) {
      reservationCloseBtn.addEventListener("click", closeReservationModal);
    }

    // clicking backdrop outside the card closes
    reservationModal.addEventListener("click", (e) => {
      if (e.target === reservationModal) closeReservationModal();
    });

    // submit = add expense via backend and update budgeting UI
    if (reservationForm) {
      reservationForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!currentTripId) {
          alert("Start a trip first.");
          return;
        }

        const amount = parseFloat(reservationAmountInput.value || "0");
        if (!amount || isNaN(amount)) {
          alert("Please enter a valid amount.");
          return;
        }

        const labelBase =
          reservationTitleInput.value.trim() || reservationCategory || "Reservation";

        try {
          const idToken = await getIdTokenIfLoggedIn();
          if (!idToken) {
            alert("Please login first.");
            return;
          }

          const res = await fetch(
            `${backendBase}/api/trips/${currentTripId}/expenses`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${idToken}`,
              },
              body: JSON.stringify({
                label: `${reservationCategory}: ${labelBase}`,
                amount,
                currency: "INR",
                category: reservationCategory || "Reservation",
              }),
            }
          );

          const json = await res.json();
          if (!json.success) {
            throw new Error(json.message || "Failed to add expense");
          }

          // reuse existing renderExpenses helper
          const expenses = json.expenses || [];
          const total = json.totalBudget || 0;

          renderExpenses(expenses, total);
          saveBudgetToLocal(expenses, total);

          // after renderExpenses(expenses, total); and saveBudgetToLocal(...);

          try {
            // if user selected a date for this reservation, attach to itinerary
            const resDate = reservationDateInput.value;
            if (resDate) {
              let itinerary = getItineraryFromLocal();
              if (itinerary.length) {
                const title =
                  reservationTitleInput.value.trim() ||
                  `${reservationCategory || "Reservation"} booking`;
                const note = reservationNotesInput.value.trim() || "";
                const time = ""; // you can later add a time field if you want

                // Try to find the day that matches this date
                let dayIndex = itinerary.findIndex((d) => d.date === resDate);

                // If not found, just push to Day 1 as fallback
                if (dayIndex < 0) dayIndex = 0;

                if (!Array.isArray(itinerary[dayIndex].items)) {
                  itinerary[dayIndex].items = [];
                }

                itinerary[dayIndex].items.push({
                  time,
                  title,
                  note,
                });

                saveItineraryToStorage(itinerary);
                renderItinerary(itinerary);
              }
            }
          } catch (e) {
            console.warn("Could not attach reservation to itinerary:", e);
          }

          closeReservationModal();
        } catch (err) {
          console.error("Failed to save reservation expense:", err);
          alert("Could not save. Please try again.");
        }
      });
    }
  }

  // ---------- Itinerary ----------

  function saveItineraryToStorage(itinerary) {
    const key = itineraryStorageKey();
    if (!key) return;
    localStorage.setItem(key, JSON.stringify(itinerary || []));
  }

  function loadItineraryFromStorage() {
    const key = itineraryStorageKey();
    if (!key) return null;
    try {
      const data = JSON.parse(localStorage.getItem(key) || "null");
      if (Array.isArray(data) && data.length) {
        renderItinerary(data);
        return data;
      }
    } catch {
      /* ignore */
    }
    return null;
  }

  function getItineraryFromLocal() {
    const key = itineraryStorageKey();
    if (!key) return [];
    try {
      const data = JSON.parse(localStorage.getItem(key) || "[]");
      if (Array.isArray(data)) return data;
    } catch { }
    return [];
  }

  function renderItinerary(itinerary = []) {
    const container = document.getElementById("itineraryContainer");
    const emptyEl = document.getElementById("itineraryEmpty");
    if (!container) return;

    if (!Array.isArray(itinerary) || !itinerary.length) {
      if (emptyEl) emptyEl.style.display = "block";
      container.innerHTML = "";
      if (emptyEl) container.appendChild(emptyEl);
      return;
    }

    if (emptyEl) emptyEl.style.display = "none";

    container.innerHTML = itinerary
      .map(
        (day) => `
      <div class="it-day">
        <div class="it-day-header">
          <div class="it-day-title">
            Day ${day.day || ""}${day.label ? " · " + day.label : ""}
          </div>
        </div>
        <div class="it-day-items">
          ${(day.items || [])
            .map(
              (item) => `
            <div class="it-item">
              <div class="it-item-time">${item.time || ""}</div>
              <div class="it-item-main">
                <div class="it-item-title">${item.title || ""}</div>
                ${item.note
                  ? `<div class="it-item-note">${item.note}</div>`
                  : ""
                }
              </div>
            </div>
          `
            )
            .join("")}
        </div>
      </div>
    `
      )
      .join("");
  }

  function rebuildItineraryFromSelectedPlaces() {
    const key = datesStorageKey();
    if (!key) return;
    let stored;
    try {
      stored = JSON.parse(localStorage.getItem(key) || "null");
    } catch {
      stored = null;
    }
    if (!stored || !stored.start || !stored.end) return;
    if (!selectedPlaces.length) {
      renderItinerary([]);
      saveItineraryToStorage([]);
      return;
    }

    const start = new Date(stored.start);
    const end = new Date(stored.end);
    if (isNaN(start) || isNaN(end) || end < start) return;

    const days =
      (end - start) / (1000 * 60 * 60 * 24) + 1; // inclusive
    const dayCount = Math.max(1, Math.round(days));
    // cover full day from 9 AM to 9 PM
    const templateTimes = ["9:00 AM", "12:00 PM", "3:00 PM", "6:00 PM", "9:00 PM"];

    const itinerary = [];
    for (let d = 0; d < dayCount; d++) {
      const dayDate = new Date(start);
      dayDate.setDate(start.getDate() + d);
      const label = dayDate.toLocaleDateString("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "short",
      });
      const dateStr = dayDate.toISOString().slice(0, 10);

      itinerary.push({
        day: d + 1,
        label,
        date: dateStr,     // store actual calendar date
        items: [],
      });
    }

    selectedPlaces.forEach((p, idx) => {
      const dayIndex = idx % itinerary.length;
      const time = templateTimes[idx % templateTimes.length];
      itinerary[dayIndex].items.push({
        time,
        title: p.name,
        note: "",
      });
    });

    renderItinerary(itinerary);
    saveItineraryToStorage(itinerary);
  }

  // ---------- Notes autosave & menu ----------

  function attachNotesAutosave() {
    if (!notesBox) return;

    let saveTimeout;
    notesBox.addEventListener("input", () => {
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(async () => {
        try {
          if (!currentTripId) return;
          const idToken = await getIdTokenIfLoggedIn();
          if (!idToken) return;

          await fetch(`${backendBase}/api/trips/${currentTripId}/notes`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify({ notes: notesBox.value }),
          });
        } catch (err) {
          console.error("Failed to save notes:", err);
        }
      }, 600);
    });
  }

  function attachNotesMenu() {
    if (!notesMenuBtn || !notesMenu) return;

    notesMenuBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      notesMenu.classList.toggle("hidden");
    });

    document.addEventListener("click", () => {
      notesMenu.classList.add("hidden");
    });

    notesMenu.addEventListener("click", (e) => e.stopPropagation());

    notesMenu
      .querySelectorAll("button")
      .forEach((btn) =>
        btn.addEventListener("click", async () => {
          const action = btn.getAttribute("data-action");
          if (action === "clear") {
            if (
              notesBox.value &&
              !confirm("Clear all notes for this trip?")
            )
              return;
            notesBox.value = "";
          } else if (action === "copy") {
            try {
              await navigator.clipboard.writeText(notesBox.value || "");
              alert("Notes copied to clipboard.");
            } catch {
              alert("Could not copy to clipboard.");
            }
          } else if (action === "ai") {
            alert("AI notes helper coming soon 🙂");
          }
          notesMenu.classList.add("hidden");
        })
      );
  }

  // ---------- Dates helpers ----------

  function updateDatesSummary() {
    if (!datesSummaryEl) return;
    const s = startDateInput.value;
    const e = endDateInput.value;
    if (!s || !e) {
      datesSummaryEl.textContent = "";
      return;
    }
    const start = new Date(s);
    const end = new Date(e);
    if (isNaN(start) || isNaN(end) || end < start) {
      datesSummaryEl.textContent = "Please choose a valid date range.";
      return;
    }
    const diffDays = (end - start) / (1000 * 60 * 60 * 24) + 1;
    const nights = Math.max(0, diffDays - 1);
    datesSummaryEl.textContent = `${diffDays} days, ${nights} nights`;
  }

  function applyDatesToHero(startStr, endStr) {
    if (!datesEl) return;
    const labelSpan = datesEl.querySelector(".muted");
    if (!labelSpan || !startStr || !endStr) return;

    const start = new Date(startStr);
    const end = new Date(endStr);
    const diffDays = (end - start) / (1000 * 60 * 60 * 24) + 1;
    const nights = Math.max(0, diffDays - 1);

    const opts = { day: "numeric", month: "short" };
    const rangeText = `${start.toLocaleDateString(
      "en-IN",
      opts
    )} – ${end.toLocaleDateString("en-IN", opts)}`;

    labelSpan.textContent = `${rangeText} · ${diffDays} days, ${nights} nights`;
  }

  function restoreDatesFromStorage() {
    if (!startDateInput || !endDateInput) return;
    const key = datesStorageKey();
    if (!key) return;
    let stored;
    try {
      stored = JSON.parse(localStorage.getItem(key) || "null");
    } catch {
      stored = null;
    }
    if (!stored || !stored.start || !stored.end) return;

    startDateInput.value = stored.start;
    endDateInput.value = stored.end;
    updateDatesSummary();
    applyDatesToHero(stored.start, stored.end);
  }

  function openDurationModal() {
    if (!durationModal) return;
    durationModal.classList.remove("hidden");
  }

  function closeDurationModal() {
    if (!durationModal) return;
    durationModal.classList.add("hidden");
  }

  function maybeAskTripDuration() {
    const key = durationStorageKey();
    if (!key) return;
    if (!localStorage.getItem(key)) {
      openDurationModal();
    }
  }

  function setupDurationModal() {
    if (!durationModal) return;

    if (durationSaveBtn) {
      durationSaveBtn.addEventListener("click", () => {
        const val = parseInt(durationSelect.value || "0", 10);
        const key = durationStorageKey();
        if (key && val > 0) {
          localStorage.setItem(key, String(val));
        }
        closeDurationModal();
      });
    }

    if (durationSkipBtn) {
      durationSkipBtn.addEventListener("click", () => {
        closeDurationModal();
      });
    }
  }

  function setupDatesModal() {
    if (!datesModal || !datesEl) return;

    datesEl.addEventListener("click", () => {
      if (!currentTripId) {
        alert("Start a trip first by choosing a city.");
        return;
      }
      const key = datesStorageKey();
      if (key) {
        try {
          const stored = JSON.parse(localStorage.getItem(key) || "null");
          if (stored) {
            startDateInput.value = stored.start || "";
            endDateInput.value = stored.end || "";
          }
        } catch {
          /* ignore */
        }
      }
      updateDatesSummary();
      datesModal.classList.remove("hidden");
    });

    // Itinerary "Add trip dates" button reuses same flow
    const itineraryDatesBtn = document.querySelector(
      ".itinerary-section .green-pill"
    );
    if (itineraryDatesBtn) {
      itineraryDatesBtn.addEventListener("click", () => {
        if (datesEl) {
          datesEl.click(); // reuse the same logic as hero dates
        }
      });
    }

    if (startDateInput) {
      startDateInput.addEventListener("change", () => {
        // auto-fill end date using duration
        const key = durationStorageKey();
        let dur = 0;
        if (key) {
          dur = parseInt(localStorage.getItem(key) || "0", 10) || 0;
        }
        if (dur > 0 && startDateInput.value) {
          const start = new Date(startDateInput.value);
          if (!isNaN(start)) {
            const end = new Date(start);
            end.setDate(end.getDate() + dur - 1);
            endDateInput.value = end.toISOString().slice(0, 10);
          }
        }
        updateDatesSummary();
      });
    }

    if (endDateInput) {
      endDateInput.addEventListener("change", updateDatesSummary);
    }

    if (datesCancelBtn) {
      datesCancelBtn.addEventListener("click", () => {
        datesModal.classList.add("hidden");
      });
    }

    if (datesSaveBtn) {
      datesSaveBtn.addEventListener("click", () => {
        if (!currentTripId) {
          alert("Start a trip first.");
          return;
        }
        const s = startDateInput.value;
        const e = endDateInput.value;
        if (!s || !e) {
          alert("Please select both start and end dates.");
          return;
        }
        const key = datesStorageKey();
        if (key) {
          localStorage.setItem(key, JSON.stringify({ start: s, end: e }));
        }
        applyDatesToHero(s, e);
        datesModal.classList.add("hidden");
        rebuildItineraryFromSelectedPlaces();
      });
    }
  }

  // ---------- Collaborators helpers ----------

  function renderMembers() {
    if (!collabAvatarsEl) return;
    if (!collaborators.length) {
      collabAvatarsEl.innerHTML = "";
      return;
    }
    collabAvatarsEl.innerHTML = collaborators
      .map((email) => {
        const initial = (email.trim()[0] || "?").toUpperCase();
        return `<div class="pill-avatar small" title="${email}">${initial}</div>`;
      })
      .join("");
  }

  function loadMembersFromStorage() {
    const key = membersStorageKey();
    if (!key) return;
    try {
      const arr = JSON.parse(localStorage.getItem(key) || "[]");
      if (Array.isArray(arr)) {
        collaborators = arr;
        renderMembers();
      }
    } catch {
      /* ignore */
    }
  }

  function setupMembersModal() {
    if (!membersModal || !addMemberBtn) return;

    addMemberBtn.addEventListener("click", () => {
      if (!currentTripId) {
        alert("Start a trip first by choosing a city.");
        return;
      }
      inviteEmailInput.value = "";
      inviteMsgInput.value = "";
      inviteResultEl.textContent = "";
      membersModal.classList.remove("hidden");
    });

    if (membersCancelBtn) {
      membersCancelBtn.addEventListener("click", () => {
        membersModal.classList.add("hidden");
      });
    }

    if (membersSendBtn) {
      membersSendBtn.addEventListener("click", () => {
        const email = (inviteEmailInput.value || "").trim();
        if (!email) {
          alert("Enter an email to invite.");
          return;
        }

        const link = `${window.location.origin}${window.location.pathname
          }?tripId=${encodeURIComponent(
            currentTripId
          )}&city=${encodeURIComponent(currentCity || "")}`;

        inviteResultEl.innerHTML = `
          We don't send email yet from the app.<br/>
          Copy & send this link to <b>${email}</b>:<br/>
          <code style="font-size:12px;">${link}</code>
        `;

        if (!collaborators.includes(email)) {
          collaborators.push(email);
          const key = membersStorageKey();
          if (key) {
            localStorage.setItem(key, JSON.stringify(collaborators));
          }
          renderMembers();
        }
      });
    }
  }

  // ---------- City modal ----------

  function openCityModal(prefillCity) {
    if (!cityModal) return;
    if (prefillCity && cityInput) cityInput.value = prefillCity;
    cityModal.classList.remove("hidden");
    loadCitySuggestionsFromBackend();
  }

  function closeCityModal() {
    if (!cityModal) return;
    cityModal.classList.add("hidden");
  }

  async function handleCityConfirm() {
    let city =
      selectedCityName || (cityInput && cityInput.value.trim()) || "";

    if (!city) {
      alert("Please select a city from the list.");
      return;
    }

    if (!allCities.length) {
      alert("Cities are still loading, please try again in a moment.");
      return;
    }

    const found = allCities.find(
      (c) => c.name.toLowerCase() === city.toLowerCase()
    );

    if (!found) {
      alert(
        "Please choose a city from the suggestions. Custom city names are not allowed yet."
      );
      return;
    }

    selectedCityName = found.name;
    closeCityModal();
    await startTripForCity(found.name);
    maybeAskTripDuration(); // ask duration right after city
  }

  function setupCityModal() {
    if (!cityModal) return;

    const suggestionsBox = document.getElementById("city-suggestions");

    if (cityInput) {
      cityInput.addEventListener("click", (e) => {
        e.stopPropagation();
        loadCitySuggestionsFromBackend();
      });

      cityInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          handleCityConfirm();
        }
      });
    }

    if (cityConfirmBtn) {
      cityConfirmBtn.addEventListener("click", (e) => {
        e.preventDefault();
        handleCityConfirm();
      });
    }

    if (cityCancelBtn) {
      cityCancelBtn.addEventListener("click", (e) => {
        e.preventDefault();
        closeCityModal();
      });
    }

    document.addEventListener("click", (e) => {
      if (!cityModal.contains(e.target) && suggestionsBox) {
        suggestionsBox.classList.add("hidden");
      }
    });
  }

  // ---------- Start / load trip for a given city ----------

  async function startTripForCity(city) {
    currentCity = city;

    if (tripTitleEl) {
      tripTitleEl.textContent = `Trip to ${city}`;
    }

    try {
      const tripInfo = await ensureTripForCity(city);
      if (tripInfo) {
        currentTripId = tripInfo.tripId;

        const p = new URLSearchParams(window.location.search);
        p.set("city", currentCity);
        p.set("tripId", currentTripId);
        window.history.replaceState({}, "", `?${p.toString()}`);

        const trip = await fetchTrip(currentTripId);
        if (trip) {
          if (notesBox) notesBox.value = trip.notes || "";
          // budget from backend first; if absent, try local
          if (trip.expenses && trip.expenses.length) {
            renderExpenses(trip.expenses || [], trip.budgetTotal || 0);
            saveBudgetToLocal(trip.expenses || [], trip.budgetTotal || 0);
          } else {
            loadBudgetFromLocal();
          }

          // itinerary: prefer local version
          if (!loadItineraryFromStorage()) {
            renderItinerary(trip.itinerary || []);
          }
        }
      }
    } catch (err) {
      console.error("Manual trip init failed:", err);
    }

    // restore local selections & UI
    loadSelectedPlacesFromStorage();
    await loadCityImages(city);
    await renderRecommendedPlaces(city);
    restoreDatesFromStorage();
    loadMembersFromStorage();

    // extra list init for this city
    extraSelectedPlaces = [];
    renderExtraSelectedPlaces();
    if (extraTitleInput) {
      extraListScope = inferScopeFromTitle(extraTitleInput.value || "");
    } else {
      extraListScope = "all";
    }
    loadExtraRecommendedPlaces();
  }

  // ---------- Main init ----------

  async function initPage() {
    const params = new URLSearchParams(window.location.search);
    const tripIdFromUrl = params.get("tripId");
    const cityParam = params.get("city");

    if (hasFirebase) {
      auth.onAuthStateChanged((user) => {
        if (user) {
          localStorage.setItem("uid", user.uid);

          if (heroOwnerAvatar) {
            const handle =
              (user.email && user.email.split("@")[0]) ||
              (user.phoneNumber && user.phoneNumber.replace("+91", "")) ||
              user.uid.slice(0, 2);
            const initial =
              (user.displayName && user.displayName[0]) ||
              (handle && handle[0]) ||
              "U";
            heroOwnerAvatar.textContent = initial.toUpperCase();
          }
        }
      });
    }

    setupCityModal();
    setupDurationModal();
    setupDatesModal();
    setupMembersModal();
    attachNotesAutosave();
    attachNotesMenu();
    attachAddExpense();
    attachReservationModal();
    attachPlaceSearch();
    setupLeftMenuScroll();
    setupSidebarHover();
    setupProfileDropdown();
    attachBudgetInteractions();
    attachExtraListInteractions();
    setupExtraList();

    if (tripIdFromUrl) {
      try {
        const trip = await fetchTrip(tripIdFromUrl);
        if (!trip) return;

        currentTripId = trip.id;
        currentCity =
          trip.mainCity || cityParam || getCityFromUrlOrTitle() || "Jaipur";

        if (tripTitleEl) {
          tripTitleEl.textContent = trip.title || `Trip to ${currentCity}`;
        }

        if (notesBox) notesBox.value = trip.notes || "";
        if (trip.expenses && trip.expenses.length) {
          renderExpenses(trip.expenses || [], trip.budgetTotal || 0);
          saveBudgetToLocal(trip.expenses || [], trip.budgetTotal || 0);
        } else {
          loadBudgetFromLocal();
        }

        loadSelectedPlacesFromStorage();
        await loadCityImages(currentCity);
        await renderRecommendedPlaces(currentCity);
        await loadExtraRecommended();
        renderExtraSelected();
        restoreDatesFromStorage();
        loadMembersFromStorage();
        if (!loadItineraryFromStorage()) {
          renderItinerary(trip.itinerary || []);
        }

        // extra list init when trip comes from URL
        extraSelectedPlaces = [];
        renderExtraSelectedPlaces();
        if (extraTitleInput) {
          extraListScope = inferScopeFromTitle(extraTitleInput.value || "");
        } else {
          extraListScope = "all";
        }
        loadExtraRecommendedPlaces();
      } catch (err) {
        console.error("Failed to init trip from tripId:", err);
      }
    } else {
      openCityModal(cityParam || "");
    }
  }

  // ---------- Place search input ----------

  function attachPlaceSearch() {
    if (!placeSearchInput) return;
    placeSearchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        searchPlaces(placeSearchInput.value || "");
      }
    });
  }

  // ---------- Left menu active state + smooth scroll ----------

  function setupLeftMenuScroll() {
    const menuItems = document.querySelectorAll(".menu-item");
    menuItems.forEach((btn) => {
      btn.addEventListener("click", () => {
        menuItems.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");

        const targetSelector = btn.getAttribute("href");
        if (!targetSelector) return;
        const target = document.querySelector(targetSelector);
        if (target) {
          target.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
    });
  }

  // ---------- Sidebar hover expand ----------

  function setupSidebarHover() {
    const layout = document.querySelector(".layout");
    const sidebar = document.querySelector(".sidebar");
    const logoImg = document.querySelector(".logo img");

    if (!layout || !sidebar || !logoImg) return;

    const openSidebar = () => {
      if (window.innerWidth > 760) {
        layout.classList.add("sidebar-expanded");
        logoImg.setAttribute("width", "168");
        logoImg.setAttribute("height", "71");
      }
    };

    const closeSidebar = () => {
      if (window.innerWidth > 760) {
        layout.classList.remove("sidebar-expanded");
        logoImg.setAttribute("width", "145");
        logoImg.setAttribute("height", "56");
      }
    };

    sidebar.addEventListener("mouseenter", openSidebar);
    sidebar.addEventListener("mouseleave", closeSidebar);
  }

  // ---------- Profile dropdown & auth (sidebar bottom) ----------

  function setupProfileDropdown() {
    const trigger =
      document.getElementById("profile-trigger") ||
      document.querySelector(".profile");
    const menu = document.getElementById("profile-menu");
    const imgEl = document.getElementById("profile-img");
    const nameEl = document.getElementById("profile-name");
    const handleEl = document.getElementById("profile-handle");

    if (!trigger || !menu) return;

    if (hasFirebase) {
      auth.onAuthStateChanged((user) => {
        if (!user) return;
        localStorage.setItem("uid", user.uid);

        if (nameEl) nameEl.textContent = user.displayName || "Traveler";
        if (imgEl) {
          imgEl.src = user.photoURL || "https://i.pravatar.cc/150?img=3";
        }
        const handle =
          (user.email && user.email.split("@")[0]) ||
          (user.phoneNumber && user.phoneNumber.replace("+91", "")) ||
          user.uid.slice(0, 6);
        if (handleEl) handleEl.textContent = "@" + handle;
      });
    }

    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      menu.classList.toggle("hidden");
      const isOpen = !menu.classList.contains("hidden");
      trigger.classList.toggle("filled", isOpen);
    });

    menu.addEventListener("click", (e) => e.stopPropagation());
    document.addEventListener("click", () => {
      menu.classList.add("hidden");
      trigger.classList.remove("filled");
    });

    const btnProfile = document.getElementById("btn-profile");
    if (btnProfile) {
      btnProfile.addEventListener("click", () => {
        alert("Profile page coming soon 🙂");
      });
    }

    const btnSettings = document.getElementById("btn-settings");
    if (btnSettings) {
      btnSettings.addEventListener("click", () => {
        alert("Settings coming soon 🙂");
      });
    }

    const btnLogout = document.getElementById("btn-logout");
    if (btnLogout) {
      btnLogout.addEventListener("click", async () => {
        try {
          if (hasFirebase) {
            const user = auth.currentUser;
            if (user) {
              const idToken = await user.getIdToken();
              await fetch(`${backendBase}/api/auth/logout`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ idToken }),
              }).catch(() => { });
            }
            await auth.signOut();
          }
          localStorage.removeItem("uid");
          window.location.href = "./login.html";
        } catch (err) {
          console.error("Logout failed:", err);
          alert("Logout failed, try again.");
        }
      });
    }
  }

  // Kick everything off
  initPage();
});
