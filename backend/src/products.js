export const products = [
  {
    id: "bakery-combo-box",
    name: "Jubilee Bakehouse Rescue Box",
    category: "Bakery",
    originalPrice: 375,
    price: 112,
    discount: 70,
    rating: 4.9,
    quantityLeft: 6,
    expiresInMinutes: 134,
    sellerId: "deccan-crown-bakery",
    seller: "Hotel Deccan Crown Bakery, Jubilee Hills",
    trustScore: 94,
    trustLabel: "Verified Reliable",
    mode: "Pickup",
    wasteKg: 2.4,
    keywords: ["bakery", "bread", "cheap dinner", "breakfast", "under 100", "expiring soon", "hotel"],
    story: "Fresh breads, rolls, and pastries released before the bakery counter closes."
  },
  {
    id: "veggie-rescue-pack",
    name: "Secunderabad Veggie Rescue Pack",
    category: "Produce",
    originalPrice: 260,
    price: 130,
    discount: 50,
    rating: 4.7,
    quantityLeft: 14,
    expiresInMinutes: 260,
    sellerId: "freshcart-secunderabad",
    seller: "FreshCart Market, Secunderabad",
    trustScore: 88,
    trustLabel: "Trusted Seller",
    mode: "Pickup",
    wasteKg: 3.1,
    keywords: ["vegetarian", "grocery", "produce", "hostel grocery", "cheap dinner", "fresh"],
    story: "Seasonal vegetables bundled for same-day pickup at half price."
  },
  {
    id: "sushi-flash-platter",
    name: "Banjara Hills Sushi Flash Platter",
    category: "Meals",
    originalPrice: 650,
    price: 149,
    discount: 80,
    rating: 4.5,
    quantityLeft: 4,
    expiresInMinutes: 48,
    sellerId: "sakura-banjara",
    seller: "Sakura Kitchen, Banjara Hills",
    trustScore: 76,
    trustLabel: "Trusted Seller",
    mode: "Pickup",
    wasteKg: 1.8,
    keywords: ["sushi", "lunch", "dinner", "expiring soon", "high protein", "meal"],
    story: "Chef-prepared platter moving fast before the evening cutoff."
  },
  {
    id: "canteen-lunch-kit",
    name: "HITEC City Lunch Kit",
    category: "Meals",
    originalPrice: 180,
    price: 79,
    discount: 67,
    rating: 4.6,
    quantityLeft: 18,
    expiresInMinutes: 95,
    sellerId: "campus-canteen",
    seller: "Cyber Canteen, HITEC City",
    trustScore: 82,
    trustLabel: "Trusted Seller",
    mode: "Pickup",
    wasteKg: 1.2,
    keywords: ["college", "canteen", "lunch", "dinner", "cheap", "under 100", "student"],
    story: "Affordable lunch trays for students and nearby workers."
  },
  {
    id: "protein-snack-bundle",
    name: "High Protein Snack Bundle",
    category: "Grocery",
    originalPrice: 240,
    price: 120,
    discount: 50,
    rating: 4.8,
    quantityLeft: 9,
    expiresInMinutes: 360,
    sellerId: "fit-fuel",
    seller: "FitFuel Pantry, Gachibowli",
    trustScore: 91,
    trustLabel: "Verified Reliable",
    mode: "Delivery",
    wasteKg: 0.9,
    keywords: ["protein", "snacks", "gym", "healthy", "grocery", "trusted sellers"],
    story: "Near-expiry bars and shakes from a verified seller."
  },
  {
    id: "event-dessert-crate",
    name: "Nampally Banquet Dessert Crate",
    category: "Bakery",
    originalPrice: 720,
    price: 230,
    discount: 68,
    rating: 4.4,
    quantityLeft: 3,
    expiresInMinutes: 70,
    sellerId: "nizam-banquets",
    seller: "Grand Nizam Banquets, Nampally",
    trustScore: 68,
    trustLabel: "New / Moderate Trust",
    mode: "Pickup",
    wasteKg: 4.6,
    keywords: ["dessert", "event", "cake", "party", "expiring soon", "bakery"],
    story: "Premium desserts released after a catered event, verified by the partner desk."
  }
];

export const categories = ["All", ...Array.from(new Set(products.map((product) => product.category)))];

export function findProduct(productId) {
  return products.find((product) => product.id === productId);
}

export function searchProducts(query = "", category = "All") {
  const normalizedQuery = query.trim().toLowerCase();
  const budgetMatch = normalizedQuery.match(/(?:under|below|less than|<=?)\s*(?:rs\.?|inr)?\s*(\d+)/);
  const budgetLimit = budgetMatch ? Number(budgetMatch[1]) : null;
  return products.filter((product) => {
    const categoryMatch = !category || category === "All" || product.category === category;
    const budgetMatch = budgetLimit === null || product.price <= budgetLimit;
    if (!normalizedQuery) return categoryMatch && budgetMatch;
    const haystack = [
      product.name,
      product.category,
      product.seller,
      product.story,
      product.trustLabel,
      String(product.price),
      ...product.keywords
    ].join(" ").toLowerCase();
    const queryTerms = normalizedQuery
      .replace(/(?:under|below|less than|<=?)\s*(?:rs\.?|inr)?\s*\d+/g, "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    return categoryMatch && budgetMatch && queryTerms.every((term) => haystack.includes(term));
  });
}

