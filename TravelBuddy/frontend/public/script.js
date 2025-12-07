// ------------- SHARED HELPERS -------------
let currentPage = 1;

function nextPage(page) {
  const pages = document.querySelectorAll(".form-page");
  const dots = document.querySelectorAll(".dot");

  pages.forEach(p => p.classList.remove("active"));
  dots.forEach(d => d.classList.remove("active"));

  const pageEl = document.getElementById(`page${page}`);
  if (pageEl) pageEl.classList.add("active");
  if (dots[page - 1]) dots[page - 1].classList.add("active");

  currentPage = page;
}

// ------------- MAIN BOOTSTRAP -------------
document.addEventListener("DOMContentLoaded", () => {
  const hasFirebase =
    !!window.firebase && typeof window.firebase.auth === "function";

  // Dashboard Lottie loader
  const dashboardLoader = document.getElementById("dashboard-loader");
  function showDashboardLoader() {
    if (dashboardLoader) dashboardLoader.classList.remove("hidden");
  }
  function hideDashboardLoader() {
    if (dashboardLoader) dashboardLoader.classList.add("hidden");
  }

  /* =========================================================
     1. LOGIN / SIGNUP PAGE (phone + OTP + password + Google)
     Only runs if login elements exist on the page
  ========================================================== */
  const googleBtn = document.querySelector(".google-btn");
  const signupForm = document.getElementById("signup-form");
  const loginForm = document.getElementById("login-form");

  if ((googleBtn || signupForm || loginForm) && !hasFirebase) {
    console.warn(
      "⚠️ Login/signup UI found but Firebase SDK is not loaded on this page."
    );
  }

  if (hasFirebase && (googleBtn || signupForm || loginForm)) {
    const auth = firebase.auth();
    const provider = new firebase.auth.GoogleAuthProvider();

    // --- Google Login ---
    if (googleBtn) {
      googleBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        try {
          const result = await auth.signInWithPopup(provider);
          const user = result.user;
          const idToken = await user.getIdToken();

          await fetch("http://localhost:4000/api/auth/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ idToken }),
          });

          localStorage.setItem("uid", user.uid);
          alert(`Welcome ${user.displayName || "Traveler"}!`);
          window.location.href = "./dashboard.html";
        } catch (error) {
          console.error("Google Login Error:", error);
          alert("Google login failed: " + error.message);
        }
      });
    }

    // --- Signup (phone + OTP + password) ---
    if (signupForm) {
      signupForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const nameVal = document.getElementById("name").value.trim();
        const phoneVal = document.getElementById("phone").value.trim();
        const passVal = document.getElementById("password").value.trim();

        if (!/^[6-9]\d{9}$/.test(phoneVal)) {
          return alert("Enter a valid 10-digit Indian mobile number");
        }

        try {
          if (!window.recaptchaVerifier) {
            window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier(
              "recaptcha-container",
              {
                size: "invisible",
                callback: () => console.log("reCAPTCHA solved ✅"),
              }
            );
          }

          const phoneNumber = "+91" + phoneVal;
          const confirmationResult =
            await firebase.auth().signInWithPhoneNumber(
              phoneNumber,
              window.recaptchaVerifier
            );

          // build OTP UI
          signupForm.innerHTML = `
            <h3>Enter OTP</h3>
            <input type="text" id="otp-input" placeholder="Enter 6-digit OTP"
                   style="margin-top:10px;width:70%;padding:6px;">
            <button id="verify-otp-btn" style="margin-top:5px;">Verify OTP</button>
            <div id="recaptcha-container"></div>
          `;

          document
            .getElementById("verify-otp-btn")
            .addEventListener("click", async () => {
              const otp = document
                .getElementById("otp-input")
                .value.trim();
              if (!otp) return alert("Please enter the OTP");

              try {
                const result = await confirmationResult.confirm(otp);
                const user = result.user;

                await user.updateProfile({ displayName: nameVal });

                const pseudoEmail = `${phoneVal}@gotravels.com`;
                try {
                  await firebase
                    .auth()
                    .createUserWithEmailAndPassword(pseudoEmail, passVal);
                } catch (err) {
                  if (!String(err.message).includes("already in use")) {
                    throw err;
                  }
                }

                const idToken = await user.getIdToken();
                await fetch("http://localhost:4000/api/auth/verify", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ idToken }),
                });

                alert("✅ Account created successfully! Please login now.");
                nextPage(2);
              } catch (err) {
                console.error("OTP Verification Error:", err);
                alert("Invalid OTP. Please try again.");
              }
            });
        } catch (error) {
          console.error("Signup Error:", error);
          alert("Signup failed: " + error.message);
        }
      });
    }

    // --- Login (phone + password) ---
    if (loginForm) {
      loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const phone = document
          .getElementById("login-Number")
          .value.trim();
        const password = document
          .getElementById("login-password")
          .value.trim();
        const pseudoEmail = `${phone}@gotravels.com`;

        try {
          const userCredential =
            await auth.signInWithEmailAndPassword(pseudoEmail, password);
          const user = userCredential.user;
          const idToken = await user.getIdToken();

          await fetch("http://localhost:4000/api/auth/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ idToken }),
          });

          localStorage.setItem("uid", user.uid);
          alert("Login successful!");
          window.location.href = "./dashboard.html";
        } catch (error) {
          alert("Login failed: " + error.message);
        }
      });
    }
  }

  /* =========================================================
     2. DASHBOARD DATA LOADER (recent/popular trips)
     Only runs if #recent-trips container exists
  ========================================================== */
  const recentContainer = document.getElementById("recent-trips");
  const popularContainer = document.getElementById("popular-trips");

  if (recentContainer && popularContainer) {
    const backendURL = "http://localhost:4000/api/trips";

    // both sections are loading
    let pendingTripLoads = 2;
    showDashboardLoader();

    function markTripsLoaded() {
      pendingTripLoads--;
      if (pendingTripLoads <= 0) {
        // wait 2 seconds *after all data is ready* before hiding loader
        setTimeout(() => {
          hideDashboardLoader();
        }, 6000);
      }
    }

    async function loadTrips(category, container) {
      try {
        const res = await fetch(`${backendURL}/${category}`);
        const data = await res.json();

        container.innerHTML = "";

        if (!data.success || !data.trips || !data.trips.length) {
          container.innerHTML = `<p style="color:gray;">No ${category} trips found.</p>`;
          return;
        }

        data.trips.forEach(async (trip, index) => {
          // Popular: show up to 6 cards (you wanted 6 popular)
          if (category === "popular" && index >= 6) return;

          // Fetch image from backend
          let imageURL = "./fallback.jpeg";
          try {
            const imgRes = await fetch(
              `http://localhost:4000/api/trips/image?path=${encodeURIComponent(
                trip.imagePath
              )}`
            );
            const imgJson = await imgRes.json();
            if (imgJson.success && imgJson.url) {
              imageURL = imgJson.url;
            }
          } catch (e) {
            console.warn("Image fetch failed, using fallback:", e);
          }

          if (category === "recent") {
            // Top strip – no itinerary creation, just show info
            const card = document.createElement("div");
            card.className = "trip-card";
            card.innerHTML = `
              <img src="${imageURL}" alt="${trip.title}">
              <div class="card-content">
                <h3>${trip.title}</h3>
                <p>${trip.duration || ""}</p>
              </div>
            `;
            card.addEventListener("click", () => {
              alert(`📍 ${trip.title}\n${trip.description || ""}`);
            });
            container.appendChild(card);
          } else {
            // Popular destinations – open trip-details page
            const card = document.createElement("div");
            card.className = "destination-card";
            card.style.backgroundImage = `url('${imageURL}')`;
            card.innerHTML = `
              <div class="card-overlay">
                <h3>${trip.title}</h3>
              </div>
            `;
            card.addEventListener("click", () => {
              const match = trip.title.match(/^(.*?)\\s+(Guide|Adventure)$/i);
              const city = match ? match[1] : trip.title;
              window.location.href =
                `trip-details.html?city=${encodeURIComponent(city)}`;
            });
            container.appendChild(card);
          }
        });
      } catch (err) {
        console.error(`❌ Error loading ${category} trips:`, err);
        container.innerHTML =
          "<p style='color:red'>Failed to load data.</p>";
      } finally {
        // mark this list as loaded (success or fail)
        markTripsLoaded();
      }
    }

    loadTrips("recent", recentContainer);
    loadTrips("popular", popularContainer);
  }

  /* =========================================================
     3. NAV BUTTON FILL ANIMATION (all pages with .navigation)
  ========================================================== */
  const navLinks = document.querySelectorAll(".navigation a");
  const FILL_ANIMATION_DURATION = 550;

  if (navLinks.length) {
    navLinks.forEach(link => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        const targetUrl = link.href;

        if (link.classList.contains("filled")) {
          window.location.href = targetUrl;
          return;
        }

        navLinks.forEach(l => l.classList.remove("active", "filled"));
        link.classList.add("active", "filled");

        setTimeout(() => {
          window.location.href = targetUrl;
        }, FILL_ANIMATION_DURATION);
      });
    });
  }

  /* =========================================================
     4. PROFILE DROPDOWN + LOGOUT (all pages with profile)
  ========================================================== */
  const trigger =
    document.getElementById("profile-trigger") ||
    document.querySelector(".profile");
  const menu = document.getElementById("profile-menu");
  const imgEl = document.getElementById("profile-img");
  const nameEl = document.getElementById("profile-name");
  const handleEl = document.getElementById("profile-handle");

  if (trigger && menu) {
    // Load Firebase user if available
    if (hasFirebase) {
      const auth = firebase.auth();

      auth.onAuthStateChanged((user) => {
        if (!user) return;

        if (nameEl) nameEl.textContent = user.displayName || "Traveler";
        if (imgEl) imgEl.src =
          user.photoURL || "https://i.pravatar.cc/150?img=3";

        const handle =
          (user.email && user.email.split("@")[0]) ||
          (user.phoneNumber && user.phoneNumber.replace("+91", "")) ||
          user.uid.slice(0, 6);

        if (handleEl) handleEl.textContent = "@" + handle;
      });
    }

    // open/close menu
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

    // Profile & settings dummy handlers
    const btnProfile = document.getElementById("btn-profile");
    if (btnProfile) btnProfile.addEventListener("click", () => {
      alert("Profile page coming soon 🙂");
    });

    const btnSettings = document.getElementById("btn-settings");
    if (btnSettings) btnSettings.addEventListener("click", () => {
      alert("Settings coming soon 🙂");
    });

    // Logout (if Firebase available)
    const btnLogout = document.getElementById("btn-logout");
    if (btnLogout) {
      btnLogout.addEventListener("click", async () => {
        try {
          if (hasFirebase) {
            const auth = firebase.auth();
            const user = auth.currentUser;

            if (user) {
              const idToken = await user.getIdToken();
              await fetch("http://localhost:4000/api/auth/logout", {
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

  /* =========================================================
     5. PLAN A TRIP PAGE (cards, left menu, sidebar hover)
     Runs only if plan-trip elements exist
  ========================================================== */

  const exploreGrid = document.getElementById("exploreGrid");
  const recCardsEl = document.getElementById("recCards");

  if (exploreGrid || recCardsEl) {
    // --- demo data ---
    const exploreData = [
      {
        title: "Best attractions in Rishikesh",
        sub: "Most often-seen on the web",
        img: "./assets/exp1.jpg"
      },
      {
        title: "Best restaurants in Rishikesh",
        sub: "Most often-seen on the web",
        img: "./assets/exp2.jpg"
      },
      {
        title: "Search hotels with transparent pricing",
        sub: "Unlike most sites, we don't sort based on commissions",
        img: "./assets/exp3.jpg"
      }
    ];

    const recommendedPlaces = [
      { name: "Laxman Jhula", img: "./assets/rec1.jpg" },
      { name: "Triveni Ghat", img: "./assets/rec2.jpg" },
      { name: "Rajaji National Park", img: "./assets/rec3.jpg" }
    ];

    // --- Explore cards ---
    if (exploreGrid) {
      exploreGrid.innerHTML = exploreData
        .map(
          (item) => `
        <div class="exp-card">
          <img src="${item.img}" alt="">
          <div class="exp-title">${item.title}</div>
          <div class="exp-sub">${item.sub}</div>
        </div>
      `
        )
        .join("");
    }

    // --- Recommended cards ---
    if (recCardsEl) {
      recCardsEl.innerHTML = recommendedPlaces
        .map(
          (p) => `
        <div class="rec-card">
          <img src="${p.img}" alt="">
          <div class="rec-name">${p.name}</div>
          <button class="rec-plus">+</button>
        </div>
      `
        )
        .join("");
    }

    // --- left panel menu active state ---
    const menuItems = document.querySelectorAll(".menu-item");
    menuItems.forEach((btn) => {
      btn.addEventListener("click", () => {
        menuItems.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
      });
    });

    // --- browse button ---
    const browseBtn = document.querySelector(".browse-btn");
    if (browseBtn) {
      browseBtn.addEventListener("click", () => {
        alert("Browse all clicked (connect to backend later)");
      });
    }

    // --- sidebar hover expand ---
    const layout = document.querySelector(".layout");
    const sidebar = document.querySelector(".sidebar");
    const logoImg = document.querySelector(".logo img");

    if (layout && sidebar && logoImg) {
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
  }
});
