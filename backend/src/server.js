import "dotenv/config";
import cors from "cors";
import express from "express";
import { categories, findProduct, products, searchProducts } from "./products.js";
import { createStore } from "./store.js";

const PORT = Number(process.env.PORT || 4000);
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:3000";
const USER_CATEGORY_KEY = (userId) => `profile:${userId}:categories`;
const TRENDING_KEY = "trending:rescue_items";
const ACTIVITY_KEY = "activity:logs";

const store = await createStore();
const { db } = store;
const app = express();

app.use(cors({ origin: CORS_ORIGIN === "*" ? true : CORS_ORIGIN }));
app.use(express.json());

function productPayload(product, score = 0) {
  return { ...product, currency: "INR", trendScore: score };
}

function createUpiReference(orderId, total) {
  const shortId = orderId.replace(/[^0-9]/g, "").slice(-6) || "000000";
  return `upi://pay?pa=ragmart@upi&pn=RAG%20MART&am=${Number(total || 0).toFixed(2)}&cu=INR&tn=${shortId}`;
}

async function logEvent(action, details = {}) {
  const event = {
    timestamp: new Date().toISOString(),
    action,
    ...details
  };
  await db.lpushTrim(ACTIVITY_KEY, JSON.stringify(event), 60);
  return event;
}

async function hydrateCart(userId) {
  const cartHash = await db.hgetall(`cart:${userId}`);
  const items = Object.entries(cartHash)
    .map(([productId, quantity]) => {
      const product = findProduct(productId);
      if (!product) return null;
      const parsedQuantity = Number(quantity);
      return {
        ...product,
        quantity: parsedQuantity,
        subtotal: parsedQuantity * product.price,
        savings: parsedQuantity * ((product.originalPrice || product.price) - product.price),
        wasteKg: parsedQuantity * (product.wasteKg || 0)
      };
    })
    .filter(Boolean);

  return {
    userId,
    items,
    totalItems: items.reduce((sum, item) => sum + item.quantity, 0),
    total: items.reduce((sum, item) => sum + item.subtotal, 0),
    savings: items.reduce((sum, item) => sum + item.savings, 0),
    wasteKg: items.reduce((sum, item) => sum + item.wasteKg, 0),
    expiresInSeconds: items.length ? 600 : 0
  };
}

async function trendingProducts(limit = 6) {
  const scores = await db.zrevrangeWithScores(TRENDING_KEY, limit);
  return scores
    .map(({ value, score }) => {
      const product = findProduct(value);
      return product ? productPayload(product, score) : null;
    })
    .filter(Boolean);
}

async function recommendationProducts(userId) {
  const cacheKey = `recommendations:${userId}`;
  const cached = await db.get(cacheKey);
  if (cached) {
    await logEvent("recommendations:hit", { userId, key: cacheKey });
    return { cache: "hit", products: JSON.parse(cached) };
  }

  const cart = await hydrateCart(userId);
  const categoryScores = await db.zrevrangeWithScores(USER_CATEGORY_KEY(userId), 4);
  const preferredCategories = [
    ...new Set([
      ...cart.items.map((item) => item.category),
      ...categoryScores.map((item) => item.value)
    ])
  ];
  const cartIds = new Set(cart.items.map((item) => item.id));

  let picks = products.filter(
    (product) => preferredCategories.includes(product.category) && !cartIds.has(product.id)
  );
  if (picks.length < 3) {
    const trending = await trendingProducts(8);
    picks = [...picks, ...trending.filter((product) => !cartIds.has(product.id))];
  }

  const unique = Array.from(new Map(picks.map((product) => [product.id, product])).values()).slice(0, 4);
  await db.setex(cacheKey, 300, JSON.stringify(unique));
  await logEvent("recommendations:miss", { userId, key: cacheKey });
  return { cache: "miss", products: unique };
}

app.get("/api/health", (_request, response) => {
  response.json({
    ok: true,
    brand: "RAG MART",
    valkey: {
      connected: store.connected,
      mode: store.mode,
      url: store.url,
      error: store.error || null
    }
  });
});

app.get("/api/products", async (request, response) => {
  const query = String(request.query.q || "");
  const category = String(request.query.category || "All");
  const results = searchProducts(query, category);

  if (query.trim()) {
    await db.zincrby("search:queries", 1, query.trim().toLowerCase());
    await logEvent("search:query", { query: query.trim(), key: "search:queries", results: results.length });
  }

  const trendScores = new Map((await db.zrevrangeWithScores(TRENDING_KEY, 100)).map((item) => [item.value, item.score]));
  response.json({
    products: results.map((product) => productPayload(product, trendScores.get(product.id) || 0)),
    categories
  });
});

app.post("/api/events/view", async (request, response) => {
  const { userId = "judge-demo", productId } = request.body;
  const product = findProduct(productId);
  if (!product) return response.status(404).json({ error: "Product not found" });

  await db.zincrby(TRENDING_KEY, product.expiresInMinutes < 60 ? 6 : 1, productId);
  await db.zincrby(USER_CATEGORY_KEY(userId), 1, product.category);
  const event = await logEvent("product:view", {
    userId,
    productId,
    product: product.name,
    key: TRENDING_KEY
  });
  response.json({ event });
});

app.get("/api/cart/:userId", async (request, response) => {
  response.json(await hydrateCart(request.params.userId));
});

app.post("/api/cart/:userId/items", async (request, response) => {
  const { productId, quantity = 1, userEmail = "", phone = "" } = request.body;
  const product = findProduct(productId);
  if (!product) return response.status(404).json({ error: "Product not found" });

  const key = `cart:${request.params.userId}`;
  const profileKey = `user:profile:${request.params.userId}`;
  const current = await db.hgetall(key);
  const nextQuantity = Number(current[productId] || 0) + Number(quantity);
  if (userEmail) await db.hset(profileKey, "email", userEmail);
  if (phone) await db.hset(profileKey, "phone", phone);
  await db.hset(key, productId, nextQuantity);
  await db.expire(key, 600);
  await db.expire(profileKey, 3600);
  await db.sadd("active:carts", request.params.userId);
  await db.zincrby(TRENDING_KEY, product.expiresInMinutes < 60 ? 8 : 3, productId);
  await db.zincrby(USER_CATEGORY_KEY(request.params.userId), 2, product.category);
  await logEvent("cart:add", {
    userId: request.params.userId,
    userEmail,
    phone: phone ? "provided" : "not_provided",
    productId,
    product: product.name,
    quantity: nextQuantity,
    key
  });
  response.status(201).json(await hydrateCart(request.params.userId));
});

app.patch("/api/cart/:userId/items/:productId", async (request, response) => {
  const quantity = Number(request.body.quantity);
  const key = `cart:${request.params.userId}`;
  if (quantity <= 0) {
    await db.hdel(key, request.params.productId);
  } else {
    await db.hset(key, request.params.productId, quantity);
  }
  await logEvent("cart:update", {
    userId: request.params.userId,
    productId: request.params.productId,
    quantity: Math.max(0, quantity),
    key
  });
  response.json(await hydrateCart(request.params.userId));
});

app.delete("/api/cart/:userId/items/:productId", async (request, response) => {
  const key = `cart:${request.params.userId}`;
  await db.hdel(key, request.params.productId);
  await logEvent("cart:remove", {
    userId: request.params.userId,
    productId: request.params.productId,
    key
  });
  response.json(await hydrateCart(request.params.userId));
});

app.get("/api/recommendations/:userId", async (request, response) => {
  response.json(await recommendationProducts(request.params.userId));
});

app.post("/api/checkout/:userId", async (request, response) => {
  const userId = request.params.userId;
  const { userEmail = "", phone = "", paymentMethod = "upi" } = request.body || {};
  const rateKey = `rate:checkout:${userId}`;
  const profileKey = `user:profile:${userId}`;
  const attempts = await db.incr(rateKey);
  if (attempts === 1) await db.expire(rateKey, 60);

  if (attempts > 5) {
    await logEvent("checkout:blocked", { userId, attempts, key: rateKey });
    return response.status(429).json({
      error: "Too many rescue claims. Please wait before trying again.",
      attempts,
      key: rateKey
    });
  }

  const cart = await hydrateCart(userId);
  if (!cart.items.length) {
    return response.status(400).json({ error: "Reservation cart is empty." });
  }

  const orderId = `ORDER-${Date.now()}`;
  const upiReference = paymentMethod === "upi" ? createUpiReference(orderId, cart.total) : "";
  if (userEmail) await db.hset(profileKey, "email", userEmail);
  if (phone) await db.hset(profileKey, "phone", phone);
  const currentImpact = await db.hgetall("metrics:impact");
  const nextItemsRescued = Number(currentImpact.items_rescued || 0) + cart.totalItems;
  const nextWastePrevented = Number(currentImpact.waste_prevented_kg || 0) + cart.wasteKg;
  const nextCustomerSavings = Number(currentImpact.customer_savings || 0) + cart.savings;
  await Promise.all(cart.items.map((item) => db.zincrby(TRENDING_KEY, 8, item.id)));
  await db.hset("metrics:impact", "items_rescued", String(nextItemsRescued));
  await db.hset("metrics:impact", "waste_prevented_kg", nextWastePrevented.toFixed(1));
  await db.hset("metrics:impact", "customer_savings", nextCustomerSavings.toFixed(2));
  await db.hset(`order:${orderId}`, "status", "claimed");
  await db.hset(`order:${orderId}`, "userId", userId);
  await db.hset(`order:${orderId}`, "userEmail", userEmail);
  await db.hset(`order:${orderId}`, "phone", phone);
  await db.hset(`order:${orderId}`, "paymentMethod", paymentMethod);
  await db.hset(`order:${orderId}`, "upiReference", upiReference);
  await db.hset(`order:${orderId}`, "sellerId", cart.items[0].sellerId);
  await db.hset(`order:${orderId}`, "total", String(cart.total));
  await db.lpushTrim(`user:orders:${userId}`, orderId, 12);
  await Promise.all(cart.items.map((item) => db.hdel(`cart:${userId}`, item.id)));
  const event = await logEvent("checkout:accepted", {
    userId,
    userEmail,
    phone: phone ? "provided" : "not_provided",
    paymentMethod,
    upiReference: upiReference ? "generated" : "",
    orderId,
    total: cart.total,
    totalItems: cart.totalItems,
    wasteKg: cart.wasteKg,
    savings: cart.savings,
    attempts,
    key: rateKey
  });
  response.json({ orderId, status: "claimed", paymentMethod, upiReference, contact: { email: userEmail, phone }, cart, event });
});

app.post("/api/rating", async (request, response) => {
  const {
    userId = "judge-demo",
    orderId = `ORDER-${Date.now()}`,
    sellerId = "deccan-crown-bakery",
    overall = 4.5,
    comment = "Good value and smooth pickup."
  } = request.body;
  const key = `rating:${orderId}`;
  const trustScore = Math.min(100, 88 + Math.round(Number(overall)));
  await db.hset(key, "userId", userId);
  await db.hset(key, "sellerId", sellerId);
  await db.hset(key, "overall", String(overall));
  await db.hset(key, "comment", comment);
  await db.zincrby(`seller:ratings:${sellerId}`, Number(overall), orderId);
  await db.hset(`seller:trust:${sellerId}`, "score", String(trustScore));
  await logEvent("rating:submitted", { userId, orderId, sellerId, overall, key });
  response.status(201).json({ success: true, key, sellerId, trustScore });
});

app.post("/api/dispute/report", async (request, response) => {
  const {
    userId = "judge-demo",
    orderId = `ORDER-${Date.now()}`,
    sellerId = "sakura-banjara",
    issueType = "not_delivered",
    description = "The seller did not deliver the product."
  } = request.body;
  const disputeId = `DISPUTE-${Date.now()}`;
  const key = `dispute:${disputeId}`;
  await db.hset(key, "userId", userId);
  await db.hset(key, "orderId", orderId);
  await db.hset(key, "sellerId", sellerId);
  await db.hset(key, "issueType", issueType);
  await db.hset(key, "description", description);
  await db.hset(key, "status", "under_review");
  await db.lpushTrim("disputes:open", disputeId, 20);
  await db.hset(`seller:trust:${sellerId}`, "score", "68");
  await logEvent("dispute:reported", { userId, orderId, sellerId, disputeId, issueType, key });
  response.status(201).json({ success: true, disputeId, status: "under_review" });
});

app.get("/api/admin/metrics", async (_request, response) => {
  const [trending, searches, eventsRaw, carts, disputesRaw, impact] = await Promise.all([
    trendingProducts(6),
    db.zrevrangeWithScores("search:queries", 8),
    db.lrange(ACTIVITY_KEY, 24),
    db.smembers("active:carts"),
    db.lrange("disputes:open", 10),
    db.hgetall("metrics:impact")
  ]);
  const events = eventsRaw.map((event) => JSON.parse(event));
  const openDisputes = disputesRaw.map((disputeId) => ({ disputeId, status: "under_review" }));
  response.json({
    valkey: {
      connected: store.connected,
      mode: store.mode,
      keys: [
        "cart:{userId}",
        TRENDING_KEY,
        "search:queries",
        "recommendations:{userId}",
        "rate:checkout:{userId}",
        "seller:trust:{sellerId}",
        "rating:{orderId}",
        "dispute:{disputeId}",
        ACTIVITY_KEY
      ]
    },
    counts: {
      activeCarts: carts.length,
      events: events.length,
      blockedCheckouts: events.filter((event) => event.action === "checkout:blocked").length,
      openDisputes: openDisputes.length,
      claimedOrders: events.filter((event) => event.action === "checkout:accepted").length
    },
    impact: {
      currency: "INR",
      itemsRescued: Number(impact.items_rescued || 50000),
      wastePreventedKg: Number(impact.waste_prevented_kg || 12000),
      customerSavings: Number(impact.customer_savings || 20000000)
    },
    sellerTrust: [
      { sellerId: "deccan-crown-bakery", seller: "Hotel Deccan Crown Bakery, Jubilee Hills", score: 94, label: "Verified Reliable" },
      { sellerId: "freshcart-secunderabad", seller: "FreshCart Market, Secunderabad", score: 88, label: "Trusted Seller" },
      { sellerId: "nizam-banquets", seller: "Grand Nizam Banquets, Nampally", score: 68, label: "New / Moderate Trust" }
    ],
    openDisputes,
    trending,
    searches,
    events
  });
});

app.listen(PORT, () => {
  console.log(`RAG MART API listening on http://localhost:${PORT}`);
  console.log(`Valkey mode: ${store.mode} (${store.url})`);
});
