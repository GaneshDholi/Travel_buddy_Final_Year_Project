document.addEventListener("DOMContentLoaded", () => {
    
    const actionBtnContainer = document.getElementById('action-btn-container');
    const userInput = document.getElementById('userInput');
    const chatHistory = document.getElementById('chatHistory');

    // Show the "Create itinerary" button after a small delay
    setTimeout(() => {
        actionBtnContainer.classList.remove('hidden');
    }, 1500);

    // --- MAP STATE ---
    let map = null;
    let currentPlaceMarker = null;

    // ========== SEND MESSAGE ==========
    window.sendMessage = async function() {
        const text = userInput.value.trim();
        if (!text) return;

        // 1. Show user message bubble
        const userMsgDiv = document.createElement('div');
        userMsgDiv.style.alignSelf = "flex-end";
        userMsgDiv.style.background = "#fff";
        userMsgDiv.style.border = "1px solid #eee";
        userMsgDiv.style.padding = "15px";
        userMsgDiv.style.borderRadius = "12px";
        userMsgDiv.style.borderBottomRightRadius = "2px";
        userMsgDiv.style.marginBottom = "20px";
        userMsgDiv.style.maxWidth = "90%";
        userMsgDiv.innerText = text;
        userMsgDiv.dataset.role = "user";
        
        chatHistory.insertBefore(userMsgDiv, actionBtnContainer);

        // 2. Chat → Map: try to highlight a location
        highlightPlaceOnMapFromText(text);

        // 3. Clear input and scroll
        userInput.value = "";
        chatHistory.scrollTop = chatHistory.scrollHeight;

        // 4. Fake "thinking"
        actionBtnContainer.classList.add('hidden');

        // 5. Use frontend-only fake AI (Phase 1)
        const aiData = fakeAIResponse(text);

        setTimeout(() => {
            handleAIResponse(aiData);
            actionBtnContainer.classList.remove('hidden');
            chatHistory.scrollTop = chatHistory.scrollHeight;
        }, 800);
    };

    // Enter key also sends message
    userInput.addEventListener("keypress", function(event) {
        if (event.key === "Enter") {
            sendMessage();
        }
    });

    // ========== HANDLE AI RESPONSE ==========
    function handleAIResponse(data) {
        const aiMsg = document.createElement('div');
        aiMsg.className = 'ai-message';
        aiMsg.innerHTML = data.replyText;
        chatHistory.insertBefore(aiMsg, actionBtnContainer);

        if (data.type === "hotels" && data.hotelSearch) {
            const btn = document.createElement('button');
            btn.textContent = "View Hotels for this trip";
            btn.style.marginTop = "10px";
            btn.style.border = "none";
            btn.style.padding = "10px 18px";
            btn.style.borderRadius = "20px";
            btn.style.cursor = "pointer";
            btn.style.fontSize = "13px";
            btn.style.backgroundColor = "#222";
            btn.style.color = "#fff";

            btn.addEventListener("click", () => {
                startHotelSearchFromChat(data.hotelSearch);
            });

            aiMsg.appendChild(document.createElement("br"));
            aiMsg.appendChild(btn);
        }
    }

    // ========== SIMPLE INTENT DETECTION + FAKE AI ==========
    function detectIntent(text) {
        const lower = text.toLowerCase();

        // Itinerary-style
        if (
            lower.includes("plan a") ||
            lower.includes("itinerary") ||
            lower.includes("trip for") ||
            lower.includes("days in") ||
            lower.includes("day trip") ||
            lower.includes("weekend trip") ||
            lower.includes("travel plan")
        ) {
            return "itinerary";
        }

        // Hotel queries
        if (
            lower.includes("hotel") ||
            lower.includes("hotels") ||
            lower.includes("stay in") ||
            lower.includes("where to stay") ||
            lower.includes("accommodation")
        ) {
            return "hotels";
        }

        // POI-style queries
        if (
            lower.includes("near ") ||
            lower.includes("around ") ||
            lower.includes("places to visit") ||
            lower.includes("what to do in")
        ) {
            return "poi_list";
        }

        // Default
        return "qna";
    }

    function fakeAIResponse(userText) {
        const intent = detectIntent(userText);

        if (intent === "itinerary") {
            return {
                type: "itinerary",
                replyText: `
                    I can help you create a day-by-day itinerary for this trip.<br>
                    Click <b>"Create itinerary with AI"</b> below when you're ready, and I'll move your request to the Live Trip section where we can structure your plan.
                `,
                itinerarySummary: {
                    prompt: userText
                }
            };
        }

        if (intent === "hotels") {
            return {
                type: "hotels",
                replyText: `
                    Got it – you're looking for stays.<br>
                    I’ll search for hotels based on your request.<br>
                    When you're ready, tap <b>"View Hotels for this trip"</b> and I'll take you to the Hotels section with this search pre-filled.
                `,
                hotelSearch: {
                    query: userText,
                    createdAt: Date.now(),
                    source: "chat-ai"
                }
            };
        }

        if (intent === "poi_list") {
            return {
                type: "poi_list",
                replyText: `
                    Let me suggest some things to do and places to visit around this area (and I’ll highlight the region on the map).<br>
                    In the full version, this would list actual attractions with ratings and distances.
                `,
                pois: []
            };
        }

        return {
            type: "qna",
            replyText: `
                I can help you with destination ideas, best time to visit, budgets, itineraries, hotels, and more.<br>
                Ask me anything about traveling in India – for example:<br>
                <ul>
                    <li>Best time to visit Leh–Ladakh</li>
                    <li>Weekend trips near Bangalore under ₹5000</li>
                    <li>Backpacking route for 7 days in Himachal</li>
                </ul>
            `
        };
    }

    // ========== ITINERARY → LIVE TRIP ==========
    window.startItineraryFromChat = function() {
        const children = Array.from(chatHistory.children);
        const userMessages = children.filter(el => el.dataset && el.dataset.role === "user");
        const lastUserMsg = userMessages.length > 0 
            ? userMessages[userMessages.length - 1].innerText 
            : "";

        const itineraryRequest = {
            prompt: lastUserMsg,
            createdAt: Date.now(),
            source: "chat-ai"
        };

        localStorage.setItem("aiItineraryRequest", JSON.stringify(itineraryRequest));
        // Adjust this filename to your actual Live Trip page
        window.location.href = "live-trip.html";
    };

    // ========== HOTELS → HOTEL PAGE ==========
    function startHotelSearchFromChat(hotelSearch) {
        localStorage.setItem("aiHotelSearch", JSON.stringify(hotelSearch));
        // Adjust this filename to your actual Hotels page
        window.location.href = "hotels.html";
    }

    // ========== MAP INITIALIZATION ==========
    const mapElement = document.getElementById('map');
    if (mapElement && typeof L !== "undefined") {
        // Center over India
        map = L.map('map').setView([22.9734, 78.6569], 5);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map);

        // Optional default marker in India
        currentPlaceMarker = L.marker([22.9734, 78.6569]).addTo(map);
        currentPlaceMarker.bindPopup("India").openPopup();

        // Map → Chat: click to suggest a trip
        map.on('click', function(e) {
            const { lat, lng } = e.latlng;

            if (currentPlaceMarker) {
                map.removeLayer(currentPlaceMarker);
            }
            currentPlaceMarker = L.marker(e.latlng).addTo(map)
                .bindPopup("Trip starting point")
                .openPopup();

            reverseGeocode(lat, lng).then(placeName => {
                if (placeName) {
                    userInput.value = `Plan a trip to ${placeName}`;
                } else {
                    const latStr = lat.toFixed(3);
                    const lngStr = lng.toFixed(3);
                    userInput.value = `Plan a trip around these coordinates: ${latStr}, ${lngStr}`;
                }
                userInput.focus();
            }).catch(() => {
                const latStr = lat.toFixed(3);
                const lngStr = lng.toFixed(3);
                userInput.value = `Plan a trip around these coordinates: ${latStr}, ${lngStr}`;
                userInput.focus();
            });
        });
    }

    // ========== CHAT → MAP: GEOCODE ANY LOCATION IN INDIA ==========
    function highlightPlaceOnMapFromText(text) {
        if (!map) return;

        const query = text.trim();
        if (!query) return;

        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            query
        )}&countrycodes=in&limit=1`;

        fetch(url, {
            headers: { "Accept-Language": "en" }
        })
        .then(res => res.json())
        .then(results => {
            if (!Array.isArray(results) || results.length === 0) return;

            const loc = results[0];
            const lat = parseFloat(loc.lat);
            const lng = parseFloat(loc.lon);
            const displayName = loc.display_name || "Selected location";

            if (isNaN(lat) || isNaN(lng)) return;

            if (currentPlaceMarker) {
                map.removeLayer(currentPlaceMarker);
            }
            currentPlaceMarker = L.marker([lat, lng]).addTo(map);
            currentPlaceMarker.bindPopup(displayName).openPopup();

            map.setView([lat, lng], 11);
        })
        .catch(err => {
            console.error("Geocoding error:", err);
        });
    }

    // ========== REVERSE GEOCODE (MAP → CHAT) ==========
    function reverseGeocode(lat, lng) {
        const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=14&addressdetails=1`;

        return fetch(url, {
            headers: { "Accept-Language": "en" }
        })
        .then(res => res.json())
        .then(data => {
            if (!data) return null;

            const addr = data.address || {};
            const parts = [
                addr.city || addr.town || addr.village || addr.hamlet || "",
                addr.state || "",
                addr.country || ""
            ].filter(Boolean);

            if (parts.length > 0) {
                return parts.join(", ");
            }

            return data.display_name || null;
        })
        .catch(err => {
            console.error("Reverse geocoding error:", err);
            return null;
        });
    }

    // ========== MAP CHAT TOGGLE ==========
    const mapChatToggle = document.querySelector('.map-chat-toggle');
    if (mapChatToggle) {
        mapChatToggle.addEventListener('click', () => {
            const chatSection = document.querySelector('.chat-section');
            if (chatSection) {
                chatSection.scrollIntoView({ behavior: 'smooth' });
            }
            userInput.focus();
        });
    }
});
