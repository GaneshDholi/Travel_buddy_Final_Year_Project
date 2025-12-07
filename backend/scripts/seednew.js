const admin = require("firebase-admin");
// Make sure this path is correct for your project structure
// It's looking for the key file in the parent directory.
const serviceAccount = require("../milan-4590e-firebase-adminsdk-bdtkc-0d446a74c2.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// Final itinerary list with updated paths and prices
const itineraries = [
  // ---------------- RECENT (3) ----------------
  {
    title: "Himachal Pradesh Adventure",
    description: "5 days in Manali exploring Solang Valley, Rohtang Pass, Old Manali, and riverside cafes.",
    duration: "5 Days, 4 Nights",
    category: "recent",
    imagePath: "trip/HP.png", // You'll need to upload this to your 'trip' folder
    highlights: ["Solang Valley", "Rohtang Pass", "Old Manali"],
    bestTime: "May – July",
    priceEstimate: "₹6,500", // Cheapest package (bus + hostel)
    from: "Delhi",
    country: "India",
    city: "Manali",
  },
  {
    title: "India Getaway (Golden Triangle)",
    description: "A cultural journey across Delhi, Jaipur & Agra with forts, food, and heritage walks.",
    duration: "10 Days, 9 Nights",
    category: "recent",
    imagePath: "trip/GT.png", // Path from your screenshot
    highlights: ["Taj Mahal", "Amber Fort", "Qutub Minar"],
    bestTime: "October – March",
    priceEstimate: "₹40,000", // Cheapest package
    from: "Delhi",
    country: "India",
    city: "Jaipur",
  },
  {
    title: "Goa Beach Trip",
    description: "Relax at Baga & Palolem beaches, enjoy seafood and Goan nightlife.",
    duration: "3 Days, 2 Nights",
    category: "recent",
    imagePath: "trip/GO.png", // Path from your screenshot
    highlights: ["Baga Beach", "Fort Aguada", "Anjuna Market"],
    bestTime: "November – February",
    priceEstimate: "₹7,500", // Cheapest package (bus/train + hostel)
    from: "Mumbai",
    country: "India",
    city: "Goa",
  },

  // ---------------- POPULAR (6) ----------------
  {
    title: "New Delhi Guide",
    description: "Historic monuments, buzzing markets, and the heart of Indian politics.",
    duration: "3 Days",
    category: "popular",
    imagePath: "trip/DE.png", // Path from your screenshot
    highlights: ["India Gate", "Qutub Minar", "Red Fort"],
    bestTime: "October – March",
    priceEstimate: "₹6,000", // On-ground cost
    priceNote: "On-ground cost (Hostel, food, local transport, entry fees). Excludes flights/trains.",
    country: "India",
    city: "New Delhi",
  },
  {
    title: "Mumbai Guide",
    description: "India’s financial capital — Bollywood, Marine Drive, and colonial architecture.",
    duration: "3 Days",
    category: "popular",
    imagePath: "trip/MU.png", // You'll need to upload this
    highlights: ["Gateway of India", "Marine Drive", "Colaba"],
    bestTime: "November – February",
    priceEstimate: "₹7,000", // On-ground cost
    priceNote: "On-ground cost (Hostel, food, local transport, entry fees). Excludes flights/trains.",
    country: "India",
    city: "Mumbai",
  },
  {
    title: "Jaipur Guide",
    description: "The Pink City — palaces, forts, and royal heritage.",
    duration: "4 Days",
    category: "popular",
    imagePath: "trip/JA.png", // You'll need to upload this
    highlights: ["Hawa Mahal", "Amber Fort", "City Palace"],
    bestTime: "October – February",
    priceEstimate: "₹7,500", // On-ground cost
    priceNote: "On-ground cost (Hostel, food, local transport, entry fees). Excludes flights/trains.",
    country: "India",
    city: "Jaipur",
  },
  {
    title: "Kolkata Guide",
    description: "Cultural capital of India — art, literature, and old colonial charm.",
    duration: "3 Days",
    category: "popular",
    imagePath: "trip/KO.png", // You'll need to upload this
    highlights: ["Victoria Memorial", "Howrah Bridge", "Park Street"],
    bestTime: "November – February",
    priceEstimate: "₹5,500", // On-ground cost
    priceNote: "On-ground cost (Hostel, food, local transport, entry fees). Excludes flights/trains.",
    country: "India",
    city: "Kolkata",
  },
  {
    title: "Rishikesh Adventure",
    description: "Yoga, river rafting, and mountains — India’s spiritual retreat.",
    duration: "4 Days",
    category: "popular",
    imagePath: "trip/RI.png", // You'll need to upload this
    highlights: ["Laxman Jhula", "Triveni Ghat", "River Rafting"],
    bestTime: "September – November",
    priceEstimate: "₹7,000", // On-ground cost
    priceNote: "On-ground cost (Hostel, food, local transport, activities). Excludes flights/trains.",
    country: "India",
    city: "Rishikesh",
  },
  {
    title: "Kerala Backwaters",
    description: "Houseboats, palm-fringed lakes, and lush landscapes.",
    duration: "5 Days",
    category: "popular",
    imagePath: "trip/KE.png", // You'll need to upload this
    highlights: ["Alleppey", "Munnar", "Kumarakom"],
    bestTime: "September – March",
    priceEstimate: "₹15,000", // On-ground cost
    priceNote: "On-ground cost (Hostels, 1-night budget houseboat, food, local transport). Excludes flights/trains.",
    country: "India",
    city: "Kochi",
  },
];

(async () => {
  try {
    const batch = db.batch();
    
    itineraries.forEach((item) => {
      // Create a copy of the item and remove the 'category' field,
      // because 'category' is now part of the database path.
      const tripData = { ...item };
      delete tripData.category;

      // Create the new, nested reference exactly as you requested:
      // /trips/{itineraries-doc}/popular/{new-trip-doc}
      // /trips/{itineraries-doc}/recent/{new-trip-doc}
      const docRef = db
        .collection("trips")           // Top-level collection "trips"
        .doc("itineraries")            // Single document "itineraries"
        .collection(item.category)     // Subcollection "popular" or "recent"
        .doc();                        // New document for the trip data
      
      // Add the operation to the batch
      batch.set(docRef, tripData);
    });

    // Commit all changes at once
    await batch.commit();
    console.log(`✅ Seeded ${itineraries.length} itineraries successfully with updated prices and paths!`);

  } catch (error) {
    console.error("❌ Error seeding database:", error);
  }
})();