import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FcGoogle } from "react-icons/fc";
import { ragMartApi } from "../api/ragMartApi";
import { signInWithGoogle, signOutRagMart } from "../firebase";
import "./RagMartPage.css";

const opsRows = [
  ["Reservation hold", "Active rescue carts release automatically after 10 minutes."],
  ["Fair access guard", "Repeated claim attempts are blocked to prevent hoarding."],
  ["Seller trust", "Ratings and issue reports update seller reliability."],
  ["Open disputes", "Not-delivered reports move into operator review."],
  ["Demand signals", "Searches, views, and claims shape trending rescues."]
];

const rescueImages = {
  "bakery-combo-box": "/assets/images/rag-mart-products/bakery-combo-box.jpg",
  "veggie-rescue-pack": "/assets/images/rag-mart-products/veggie-rescue-pack.jpg",
  "sushi-flash-platter": "/assets/images/rag-mart-products/sushi-flash-platter.jpg",
  "canteen-lunch-kit": "/assets/images/rag-mart-products/canteen-lunch-kit.jpg",
  "protein-snack-bundle": "/assets/images/rag-mart-products/protein-snack-bundle.jpg",
  "event-dessert-crate": "/assets/images/rag-mart-products/event-dessert-crate.jpg"
};

const productIcons = {
  "bakery-combo-box": "ph ph-bread",
  "veggie-rescue-pack": "ph ph-carrot",
  "sushi-flash-platter": "ph ph-bowl-food",
  "canteen-lunch-kit": "ph ph-fork-knife",
  "protein-snack-bundle": "ph ph-barbell",
  "event-dessert-crate": "ph ph-cake"
};

const paymentMethods = [
  { id: "upi", label: "UPI", hint: "Generate a UPI collection reference" },
  { id: "cash_pickup", label: "Cash at pickup", hint: "Pay the partner at the pickup counter" },
  { id: "card", label: "Card", hint: "Use card authorization at order desk" }
];

const currencyByRegion = {
  IN: { currency: "INR", rateFromInr: 1, place: "India" },
  US: { currency: "USD", rateFromInr: 0.012, place: "United States" },
  GB: { currency: "GBP", rateFromInr: 0.0095, place: "United Kingdom" },
  EU: { currency: "EUR", rateFromInr: 0.011, place: "Europe" },
  AE: { currency: "AED", rateFromInr: 0.044, place: "United Arab Emirates" },
  SG: { currency: "SGD", rateFromInr: 0.016, place: "Singapore" },
  AU: { currency: "AUD", rateFromInr: 0.018, place: "Australia" },
  CA: { currency: "CAD", rateFromInr: 0.016, place: "Canada" }
};

function detectCurrencyProfile() {
  const locale = navigator.language || "en-IN";
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  let region = "IN";
  try {
    region = new Intl.Locale(locale).region || region;
  } catch (_error) {
    region = locale.split("-")[1] || region;
  }
  if (/Kolkata|Calcutta|India/i.test(timeZone)) region = "IN";
  const profile = currencyByRegion[region] || currencyByRegion.IN;
  return {
    locale: region === "IN" ? "en-IN" : locale,
    region,
    timeZone,
    source: timeZone || locale,
    ...profile
  };
}

const formatCurrency = (value, currencyProfile) =>
  new Intl.NumberFormat(currencyProfile.locale, {
    style: "currency",
    currency: currencyProfile.currency,
    maximumFractionDigits: currencyProfile.currency === "INR" ? 0 : 2
  }).format((value || 0) * currencyProfile.rateFromInr);

function emailToUserId(email) {
  return `user-${email.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

function readSession() {
  try {
    const session = JSON.parse(window.localStorage.getItem("ragMartSession") || "null");
    if (session?.email === "judge@example.com") {
      window.localStorage.removeItem("ragMartSession");
      return null;
    }
    return session;
  } catch (_error) {
    return null;
  }
}

function saveSession(session) {
  window.localStorage.setItem("ragMartSession", JSON.stringify(session));
}

function DealImage({ product, compact = false }) {
  return (
    <div className={`deal-image product-${product.id} ${compact ? "is-compact" : ""}`}>
      {rescueImages[product.id] ? (
        <img src={rescueImages[product.id]} alt={product.name} />
      ) : (
        <>
          <i className={productIcons[product.id] || "ph ph-package"} />
          {!compact && <span>{product.category}</span>}
        </>
      )}
    </div>
  );
}

function IngredientsList({ product, compact = false }) {
  const ingredients = product.ingredients || [];
  if (!ingredients.length) return null;

  return (
    <div className={`ingredients-row ${compact ? "is-compact" : ""}`}>
      <span>Ingredients</span>
      <div>
        {ingredients.slice(0, compact ? 3 : 5).map((ingredient) => (
          <em key={ingredient}>{ingredient}</em>
        ))}
      </div>
    </div>
  );
}

function RescueDealCard({ product, onView, onAdd, money }) {
  return (
    <article className="rescue-deal-card">
      <div className="deal-media">
        <DealImage product={product} />
        <span className="deal-discount">-{product.discount}%</span>
        <button type="button" className="deal-view" onClick={() => onView(product)}>
          <i className="ph ph-eye" />
        </button>
      </div>
      <div className="deal-content">
        <div className="deal-row">
          <span className="deal-chip danger"><i className="ph ph-timer" /> {product.expiresInMinutes} min</span>
          <span className="deal-chip">{product.quantityLeft} left</span>
        </div>
        <h3>{product.name}</h3>
        <p>{product.story}</p>
        <IngredientsList product={product} />
        <div className="seller-box">
          <i className="ph ph-seal-check" />
          <div>
            <strong>{product.seller}</strong>
            <span>{product.rating} rating - Trust {product.trustScore}/100 - {product.mode}</span>
          </div>
        </div>
        <div className="deal-footer">
          <div>
            <span className="old-price">{money(product.originalPrice)}</span>
            <strong>{money(product.price)}</strong>
          </div>
          <button type="button" onClick={() => onAdd(product)}>
            Rescue item <i className="ph ph-shopping-bag" />
          </button>
        </div>
      </div>
    </article>
  );
}

function CartPanel({
  cart,
  onQuantity,
  onRemove,
  onCheckout,
  checkoutState,
  money,
  user,
  onOpenLogin,
  onSavePhone,
  paymentMethod,
  onPaymentMethodChange
}) {
  const [phoneDraft, setPhoneDraft] = useState(user?.phone || "");

  useEffect(() => {
    setPhoneDraft(user?.phone || "");
  }, [user?.phone]);

  return (
    <aside className="rescue-panel reservation-cart" id="cart">
      <div className="panel-heading">
        <span>Live reservation cart</span>
        <h2>Reservation Cart</h2>
      </div>
      <div className="tech-note">Reserved items stay held briefly while you finish checkout.</div>
      <div className="reservation-timer">
        <span>Reserved for</span>
        <strong>{cart.items.length ? "10:00" : "--:--"}</strong>
      </div>
      <div className="contact-card">
        {user ? (
          <>
            <strong>{user.email}</strong>
            <span>{user.phone ? `Pickup updates: ${user.phone}` : "Add phone number for pickup updates."}</span>
            <div>
              <input
                value={phoneDraft}
                onChange={(event) => setPhoneDraft(event.target.value)}
                placeholder="Optional phone number"
              />
              <button type="button" onClick={() => onSavePhone(phoneDraft)}>Save</button>
            </div>
          </>
        ) : (
          <>
            <strong>Login required</strong>
            <span>Use your email to reserve rescue deals.</span>
            <button type="button" onClick={onOpenLogin}>Login to continue</button>
          </>
        )}
      </div>
      {cart.items.length === 0 ? (
        <div className="empty-state">
          <i className="ph ph-basket" />
          <p>Add a rescue deal. Your reservation stays available while you finish the order.</p>
        </div>
      ) : (
        <div className="cart-list">
          {cart.items.map((item) => (
            <div className="cart-item" key={item.id}>
              <DealImage product={item} compact />
              <div>
                <strong>{item.name}</strong>
                <span>{money(item.subtotal)} - saves {money(item.savings)}</span>
              </div>
              <div className="stepper">
                <button type="button" onClick={() => onQuantity(item, item.quantity - 1)}><i className="ph ph-minus" /></button>
                <span>{item.quantity}</span>
                <button type="button" onClick={() => onQuantity(item, item.quantity + 1)}><i className="ph ph-plus" /></button>
              </div>
              <button className="remove" type="button" onClick={() => onRemove(item)}><i className="ph ph-x" /></button>
            </div>
          ))}
        </div>
      )}
      <div className="cart-total">
        <span>{cart.totalItems} items - {Number(cart.wasteKg || 0).toFixed(1)} kg saved</span>
        <strong>{money(cart.total)}</strong>
      </div>
      <div className="payment-box">
        <h3>Payment option</h3>
        <div>
          {paymentMethods.map((method) => (
            <label key={method.id} className={paymentMethod === method.id ? "selected" : ""}>
              <input
                type="radio"
                name="paymentMethod"
                value={method.id}
                checked={paymentMethod === method.id}
                onChange={() => onPaymentMethodChange(method.id)}
              />
              <span>
                <strong>{method.label}</strong>
                {method.hint}
              </span>
            </label>
          ))}
        </div>
      </div>
      <button className="claim-button" type="button" onClick={onCheckout}>
        Order now <i className="ph ph-credit-card" />
      </button>
      {checkoutState.message && (
        <div className={`checkout-message ${checkoutState.error ? "is-error" : "is-success"}`}>
          {checkoutState.message}
        </div>
      )}
    </aside>
  );
}

function Recommendations({ recommendations }) {
  return (
    <section className="rescue-panel">
      <div className="panel-heading">
        <span>Picked for you</span>
        <h2>Recommended rescues</h2>
      </div>
      <div className="tech-note">Fresh picks based on your cart, searches, and trusted sellers.</div>
      <div className="mini-list">
        {recommendations.products.map((product) => (
          <div key={product.id}>
            <DealImage product={product} compact />
            <span>
              <strong>{product.name}</strong>
              {product.trustLabel}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function OrdersPanel({ orders, money }) {
  return (
    <section className="orders-section" id="orders">
      <div className="section-title">
        <h2>Your Rescue Orders</h2>
        <p>Review claimed orders, selected payment option, and pickup contact details.</p>
      </div>
      {orders.length === 0 ? (
        <div className="orders-empty">
          <i className="ph ph-package" />
          <strong>No orders yet</strong>
          <span>Add a rescue deal to cart, choose payment, and click Order now.</span>
        </div>
      ) : (
        <div className="orders-list">
          {orders.map((order) => (
            <article key={order.orderId}>
              <span>{order.status}</span>
              <h3>{order.orderId}</h3>
              <p>{order.items} items - {money(order.total)} - {order.paymentLabel}</p>
              {order.upiReference && <code>{order.upiReference}</code>}
              <small>{order.phone ? `Pickup updates: ${order.phone}` : "No phone number added"}</small>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function LoginModal({ open, onClose, onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);

  if (!open) return null;

  const submit = (event) => {
    event.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    if (!password.trim()) {
      setError("Enter a password to continue with email.");
      return;
    }
    onLogin({ email: email.trim(), phone: phone.trim() });
    setEmail("");
    setPassword("");
    setPhone("");
    setError("");
  };

  const continueWithGoogle = async () => {
    setGoogleLoading(true);
    setError("");
    try {
      const googleUser = await signInWithGoogle();
      onLogin({
        email: googleUser.email || "",
        phone: phone.trim() || googleUser.phoneNumber || "",
        displayName: googleUser.displayName || "",
        photoURL: googleUser.photoURL || "",
        provider: "google"
      });
      setEmail("");
      setPassword("");
      setPhone("");
    } catch (firebaseError) {
      const code = firebaseError?.code || "";
      const messageByCode = {
        "auth/popup-closed-by-user": "Google sign-in was closed before it finished.",
        "auth/cancelled-popup-request": "Another Google sign-in window is already open.",
        "auth/popup-blocked": "The browser blocked the Google sign-in popup. Allow popups for this site and try again.",
        "auth/operation-not-allowed": "Google sign-in is not enabled in Firebase Authentication for this project.",
        "auth/unauthorized-domain": "This domain is not authorized in Firebase Authentication settings."
      };
      setError(messageByCode[code] || firebaseError?.message || "Google sign-in could not be completed.");
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="login-backdrop" role="presentation">
      <form className="login-modal" onSubmit={submit}>
        <button className="modal-close" type="button" onClick={onClose} aria-label="Close login">
          <i className="ph ph-x" />
        </button>
        <a href="#home" className="login-logo" onClick={(event) => event.preventDefault()}>
          <img src="/assets/images/rag-mart-logo.png" alt="RAG MART logo" />
        </a>
        <h2>Login to RAG MART</h2>
        <p>Reserve surplus deals, track pickup updates, and complete orders faster.</p>
        {error && <div className="form-error">{error}</div>}
        <button className="google-login-button" type="button" onClick={continueWithGoogle} disabled={googleLoading}>
          <FcGoogle />
          {googleLoading ? "Opening Google..." : "Continue with Google"}
        </button>
        <div className="login-divider"><span>or</span></div>
        <input
          aria-label="Email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Email"
          type="email"
          required
        />
        <input
          aria-label="Password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Password"
          type="password"
          required
        />
        <input
          aria-label="Phone number"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          placeholder="Phone number for pickup updates (optional)"
        />
        <button className="claim-button" type="submit">Login</button>
        <div className="signup-text">
          <span>Don't have an account?</span>
          <button type="button" onClick={continueWithGoogle}>Sign up</button>
        </div>
      </form>
    </div>
  );
}

function AdminDashboard({ metrics, onRate, onDispute, money, adminMessage }) {
  const [showTechnicalLogs, setShowTechnicalLogs] = useState(false);
  const events = metrics.events || [];
  const impact = metrics.impact || {};
  const eventCopy = {
    "recommendations:hit": "Recommendation cache served instantly.",
    "recommendations:miss": "Fresh recommendations generated and cached.",
    "checkout:blocked": "Fair access guard blocked repeated claims.",
    "checkout:accepted": "Rescue order claimed and impact metrics updated.",
    "dispute:reported": "Customer issue moved to operator review.",
    "rating:submitted": "Seller rating and trust score updated.",
    "cart:add": "Rescue item reserved in cart.",
    "cart:update": "Reservation quantity changed.",
    "cart:remove": "Reservation item removed.",
    "product:view": "Deal view counted for urgency ranking.",
    "search:query": "Search demand signal recorded."
  };
  const eventTitle = {
    "recommendations:hit": "Recommendation served",
    "recommendations:miss": "Recommendation refreshed",
    "checkout:blocked": "Claim blocked",
    "checkout:accepted": "Order claimed",
    "dispute:reported": "Issue reported",
    "rating:submitted": "Rating received",
    "cart:add": "Item reserved",
    "cart:update": "Reservation updated",
    "cart:remove": "Reservation removed",
    "product:view": "Deal viewed",
    "search:query": "Search recorded"
  };

  return (
    <section className="admin-dashboard" id="admin">
      <div className="dashboard-header">
        <div>
          <span>Admin Trust & Dispute Dashboard</span>
          <h2>Valkey activity terminal</h2>
        </div>
        <div className="dashboard-actions">
          <button type="button" onClick={onRate}>Submit rating</button>
          <button type="button" onClick={onDispute}>Report not delivered</button>
        </div>
      </div>
      {adminMessage && <div className="admin-message">{adminMessage}</div>}

      <div className="metric-grid">
        <div><strong>{impact.itemsRescued?.toLocaleString?.() || "50k+"}</strong><span>Items rescued</span></div>
        <div><strong>{impact.wastePreventedKg?.toLocaleString?.() || "12k"} kg</strong><span>Waste prevented</span></div>
        <div><strong>{money(impact.customerSavings || 20000000)}</strong><span>Customer savings</span></div>
        <div><strong>{metrics.counts?.openDisputes || 0}</strong><span>Open disputes</span></div>
      </div>

      <div className="dashboard-grid">
        <div className="dark-table">
          <p>Live rescue operations</p>
          <table>
            <thead>
              <tr><th>Workflow</th><th>What operators watch</th></tr>
            </thead>
            <tbody>
              {opsRows.map(([workflow, description]) => (
                <tr key={workflow}><td>{workflow}</td><td>{description}</td></tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="dark-panel">
          <h3>Urgency Trending</h3>
          <div className="ranked-list">
            {(metrics.trending || []).map((product, index) => (
              <div key={product.id}><span>{String(index + 1).padStart(2, "0")}</span><strong>{product.name}</strong><em>{product.trendScore}</em></div>
            ))}
          </div>
        </div>

        <div className="dark-panel">
          <h3>Seller Trust</h3>
          <div className="ranked-list">
            {(metrics.sellerTrust || []).map((seller) => (
              <div key={seller.sellerId}><span>{seller.score}</span><strong>{seller.seller}</strong><em>{seller.label}</em></div>
            ))}
          </div>
        </div>

        <div className="dark-panel">
          <h3>Popular Searches</h3>
          <div className="ranked-list">
            {(metrics.searches || []).map((search, index) => (
              <div key={search.value}><span>{String(index + 1).padStart(2, "0")}</span><strong>{search.value}</strong><em>{search.score}</em></div>
            ))}
          </div>
        </div>

        <div className="dark-panel terminal">
          <div className="terminal-heading">
            <h3>{showTechnicalLogs ? "Admin Technical Logs" : "Operator Event Feed"}</h3>
            <button type="button" onClick={() => setShowTechnicalLogs((visible) => !visible)}>
              {showTechnicalLogs ? "Hide raw keys" : "Show admin logs"}
            </button>
          </div>
          {events.map((event) => (
            <div key={`${event.timestamp}-${event.action}-${event.key}`}>
              <span>{new Date(event.timestamp).toLocaleTimeString()}</span>
              <strong>{showTechnicalLogs ? event.action : eventTitle[event.action] || "Marketplace event"}</strong>
              {showTechnicalLogs ? (
                <code>{event.key} {event.userEmail ? `- ${event.userEmail}` : ""} {event.phone ? `- phone ${event.phone}` : ""}</code>
              ) : (
                <p>
                  {eventCopy[event.action] || "Marketplace activity recorded for operators."}
                  {event.userEmail ? ` Shopper: ${event.userEmail}.` : ""}
                  {event.phone === "provided" ? " Phone contact is saved." : ""}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const initialCart = { items: [], totalItems: 0, total: 0, wasteKg: 0, savings: 0 };
const categoryCards = [
  { label: "Fresh Harvest", title: "Perishables & Produce", count: "142 active deals", icon: "ph ph-carrot", category: "Produce" },
  { label: "Meal Rescue", title: "Lunch Kits & Ready Meals", count: "96 active deals", icon: "ph ph-fork-knife", category: "Meals" },
  { label: "Bakery Rescue", title: "Bread Boxes & Desserts", count: "74 active deals", icon: "ph ph-bread", category: "Bakery" },
  { label: "Pantry Deals", title: "Grocery & Essentials", count: "215 active deals", icon: "ph ph-shopping-bag-open", category: "Grocery" }
];

const RagMartPage = () => {
  const [user, setUser] = useState(() => readSession());
  const userId = useMemo(() => (user ? emailToUserId(user.email) : "guest-preview"), [user]);
  const [currencyProfile, setCurrencyProfile] = useState(() => detectCurrencyProfile());
  const money = useCallback((value) => formatCurrency(value, currencyProfile), [currencyProfile]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState(["All"]);
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState(initialCart);
  const [paymentMethod, setPaymentMethod] = useState("upi");
  const [orders, setOrders] = useState(() => {
    try {
      return JSON.parse(window.localStorage.getItem("ragMartOrders") || "[]");
    } catch (_error) {
      return [];
    }
  });
  const [recommendations, setRecommendations] = useState({ cache: "", products: [] });
  const [metrics, setMetrics] = useState({ events: [], searches: [], trending: [], counts: {} });
  const [checkoutState, setCheckoutState] = useState({ message: "", error: false });
  const [adminMessage, setAdminMessage] = useState("");
  const [loginOpen, setLoginOpen] = useState(false);
  const [operatorOpen, setOperatorOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [locationMessage, setLocationMessage] = useState(
    "Showing Hyderabad pickup partners around Jubilee Hills, HITEC City, Banjara Hills, and Secunderabad."
  );
  const [apiError, setApiError] = useState("");
  const [timeLeft, setTimeLeft] = useState(8030);

  const refreshCart = useCallback(async () => {
    if (!user) return setCart(initialCart);
    setCart(await ragMartApi.cart(userId));
  }, [user, userId]);
  const refreshRecommendations = useCallback(async () => {
    setRecommendations(await ragMartApi.recommendations(userId));
  }, [userId]);
  const refreshMetrics = useCallback(async () => setMetrics(await ragMartApi.metrics()), []);
  const refreshProducts = useCallback(async () => {
    const response = await ragMartApi.products({ query, category });
    setProducts(response.products);
    setCategories(response.categories);
  }, [category, query]);

  const refreshAll = useCallback(async () => {
    try {
      setApiError("");
      await ragMartApi.health();
      await Promise.all([refreshProducts(), refreshCart(), refreshRecommendations(), refreshMetrics()]);
    } catch (error) {
      setApiError(error.message);
    }
  }, [refreshCart, refreshMetrics, refreshProducts, refreshRecommendations]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    const timer = window.setInterval(() => refreshMetrics().catch(() => {}), 4000);
    return () => window.clearInterval(timer);
  }, [refreshMetrics]);

  useEffect(() => {
    const timer = window.setInterval(() => setTimeLeft((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const trackView = async (product) => {
    await ragMartApi.viewProduct({ userId, productId: product.id });
    await Promise.all([refreshMetrics(), refreshProducts(), refreshRecommendations()]);
  };

  const addProduct = async (product) => {
    if (!user) {
      setLoginOpen(true);
      setCheckoutState({ message: "Login with any email to reserve this rescue deal.", error: true });
      return;
    }
    await ragMartApi.addToCart({
      userId,
      productId: product.id,
      quantity: 1,
      userEmail: user.email,
      phone: user.phone || ""
    });
    setCheckoutState({ message: `${product.name} reserved for 10 minutes.`, error: false });
    await Promise.all([refreshCart(), refreshRecommendations(), refreshMetrics(), refreshProducts()]);
  };

  const updateQuantity = async (item, quantity) => {
    await ragMartApi.updateCartItem({ userId, productId: item.id, quantity });
    await Promise.all([refreshCart(), refreshRecommendations(), refreshMetrics()]);
  };

  const removeItem = async (item) => {
    await ragMartApi.removeCartItem({ userId, productId: item.id });
    await Promise.all([refreshCart(), refreshRecommendations(), refreshMetrics()]);
  };

  const checkout = async () => {
    if (!user) {
      setLoginOpen(true);
      setCheckoutState({ message: "Please login before claiming a rescue order.", error: true });
      return;
    }
    try {
      const order = await ragMartApi.checkout(userId, { userEmail: user.email, phone: user.phone || "", paymentMethod });
      const paymentLabel = paymentMethods.find((method) => method.id === paymentMethod)?.label || "Payment";
      const nextOrder = {
        orderId: order.orderId,
        status: "claimed",
        total: order.cart.total,
        items: order.cart.totalItems,
        paymentLabel,
        upiReference: order.upiReference || "",
        phone: order.contact?.phone || "",
        createdAt: new Date().toISOString()
      };
      const nextOrders = [nextOrder, ...orders].slice(0, 8);
      setOrders(nextOrders);
      window.localStorage.setItem("ragMartOrders", JSON.stringify(nextOrders));
      const contact = order.contact?.phone ? ` Pickup updates will go to ${order.contact.phone}.` : " Add phone number for pickup updates.";
      const upiText = order.upiReference ? ` UPI reference generated: ${order.upiReference}.` : "";
      setCheckoutState({ message: `${order.orderId} confirmed with ${paymentLabel}.${upiText}${contact}`, error: false });
    } catch (error) {
      setCheckoutState({ message: error.data?.error || error.message, error: true });
    } finally {
      await Promise.all([refreshCart(), refreshMetrics(), refreshProducts()]);
    }
  };

  const submitRating = async () => {
    const result = await ragMartApi.rateOrder({ userId, userEmail: user?.email || "", sellerId: "deccan-crown-bakery", overall: 4.8 });
    setAdminMessage(`Rating submitted. Hotel Deccan Crown Bakery trust is now ${result.trustScore}/100.`);
    await Promise.all([refreshMetrics(), refreshProducts()]);
  };

  const reportDispute = async () => {
    const result = await ragMartApi.reportDispute({ userId, userEmail: user?.email || "", sellerId: "sakura-banjara", issueType: "not_delivered" });
    setAdminMessage(`${result.disputeId} opened for operator review.`);
    await refreshMetrics();
  };

  const login = (session) => {
    const nextSession = { ...session, signedInAt: new Date().toISOString() };
    saveSession(nextSession);
    setUser(nextSession);
    setLoginOpen(false);
    setCheckoutState({ message: `Logged in as ${nextSession.email}. You can now reserve rescue deals.`, error: false });
  };

  const logout = () => {
    window.localStorage.removeItem("ragMartSession");
    signOutRagMart();
    setUser(null);
    setCart(initialCart);
    setOperatorOpen(false);
    setCheckoutState({ message: "Logged out. Login again to reserve items.", error: false });
  };

  const savePhone = (phone) => {
    if (!user) {
      setLoginOpen(true);
      return;
    }
    const nextSession = { ...user, phone: phone.trim() };
    saveSession(nextSession);
    setUser(nextSession);
    setCheckoutState({ message: nextSession.phone ? `Phone saved: ${nextSession.phone}` : "Phone removed.", error: false });
  };

  const enablePreciseLocation = () => {
    if (!navigator.geolocation) {
      setLocationMessage("Precise location is not available in this browser. Using browser locale instead.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextProfile = detectCurrencyProfile();
        setCurrencyProfile(nextProfile);
        setLocationMessage(
          `Precise location enabled near ${position.coords.latitude.toFixed(2)}, ${position.coords.longitude.toFixed(2)}. Currency: ${nextProfile.currency}.`
        );
      },
      () => {
        setLocationMessage("Location permission was not granted. Currency is still based on browser region/time zone.");
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
    );
  };

  const submitSearch = (event) => {
    event.preventDefault();
    setCategory("All");
    window.requestAnimationFrame(() => {
      document.getElementById("rescue")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const chooseCategory = (nextCategory) => {
    setQuery("");
    setCategory(nextCategory);
    window.requestAnimationFrame(() => {
      document.getElementById("deals")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const heroProduct = products.find((product) => product.id === "bakery-combo-box") || products[0];
  const countdown = `${String(Math.floor(timeLeft / 3600)).padStart(2, "0")}:${String(
    Math.floor((timeLeft % 3600) / 60)
  ).padStart(2, "0")}:${String(timeLeft % 60).padStart(2, "0")}`;

  return (
    <main className="rescue-page">
      <header className={`top-app-bar ${menuOpen ? "is-open" : ""}`}>
        <div className="header-shell">
          <div className="header-row">
            <a href="#home" className="rescue-logo" aria-label="RAG MART home">
              <img src="/assets/images/rag-mart-logo.png" alt="RAG MART logo" />
              <span>RAG MART</span>
            </a>
            <nav className="desktop-nav">
              <a className="active" href="#home">Home</a>
              <a href="#rescue">Rescue</a>
              <a href="#cart">Cart</a>
              <a href="#orders">Orders</a>
              <a href="#nearby">Nearby</a>
              <button type="button" onClick={() => (user ? setOperatorOpen((open) => !open) : setLoginOpen(true))}>Resources</button>
            </nav>
            <div className="header-actions">
              {user ? (
                <div className="user-menu">
                  {user.photoURL && <img src={user.photoURL} alt="" />}
                  <span>{user.email}</span>
                  <button type="button" onClick={() => setOperatorOpen((open) => !open)}>Partner</button>
                  <button type="button" onClick={logout}>Logout</button>
                </div>
              ) : (
                <button className="admin-button" type="button" onClick={() => setLoginOpen(true)}>Login</button>
              )}
              <button
                className="menu-toggle"
                type="button"
                aria-label={menuOpen ? "Close menu" : "Open menu"}
                onClick={() => setMenuOpen((open) => !open)}
              >
                <i className={menuOpen ? "ph ph-x" : "ph ph-list"} />
              </button>
            </div>
          </div>
          <div className="mobile-menu">
            <a href="#home" onClick={() => setMenuOpen(false)}>Home</a>
            <a href="#rescue" onClick={() => setMenuOpen(false)}>Rescue Deals</a>
            <a href="#cart" onClick={() => setMenuOpen(false)}>Cart</a>
            <a href="#orders" onClick={() => setMenuOpen(false)}>Orders</a>
            <a href="#nearby" onClick={() => setMenuOpen(false)}>Nearby</a>
            <button type="button" onClick={() => { setMenuOpen(false); user ? setOperatorOpen((open) => !open) : setLoginOpen(true); }}>Operator Console</button>
          </div>
        </div>
      </header>

      <section className="rescue-hero" id="home">
        <div className="hero-copy">
          <div className="live-badge"><span /> Real-time Surplus Tracking Active</div>
          <h1>RAG MART <span>Turn expiring surplus into trusted real-time opportunity.</span></h1>
          <form className="hero-search" onSubmit={submitSearch}>
            <i className="ph ph-magnifying-glass" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search Hyderabad rescue deals: biryani, bakery, veggies under 100..."
            />
            <button type="submit">Search</button>
          </form>
          <div className="hero-actions">
            <a href="#rescue">Find Rescue Deals <i className="ph ph-trending-down" /></a>
            <button type="button" onClick={() => (user ? setOperatorOpen(true) : setLoginOpen(true))}>
              Partner console <i className="ph ph-chart-line" />
            </button>
          </div>
          <div className="impact-stats">
            <div><strong>50k+</strong><span>Items Rescued</span></div>
            <div><strong>12 Tons</strong><span>Waste Prevented</span></div>
            <div><strong>{money(20000000)}+</strong><span>Customer Savings</span></div>
            <div><strong>500+</strong><span>Trusted Sellers</span></div>
          </div>
        </div>

        {heroProduct && (
          <article className="urgent-card">
            <div className="urgent-top">
              <span><i className="ph ph-timer" /> Expiring soon</span>
              <button type="button"><i className="ph ph-share-network" /></button>
            </div>
            <div className="urgent-media">
              <DealImage product={heroProduct} />
              <strong>-{heroProduct.discount}%</strong>
            </div>
            <h2>{heroProduct.name}</h2>
            <p>{heroProduct.story}</p>
            <IngredientsList product={heroProduct} compact />
            <div className="seller-box">
              <i className="ph ph-seal-check" />
              <div>
                <strong>{heroProduct.seller}</strong>
                <span>{heroProduct.rating} rating - Trust {heroProduct.trustScore}/100</span>
              </div>
              <em>{countdown}</em>
            </div>
            <button className="claim-button shimmer" type="button" onClick={() => addProduct(heroProduct)}>
              Rescue item <i className="ph ph-shopping-bag" />
            </button>
          </article>
        )}
      </section>

      <section className="trending-feed">
        <div className="feed-heading">
          <h2><i className="ph ph-chart-line-up" /> Trending Now</h2>
          <span>Live updates</span>
        </div>
        <div className="feed-grid">
          <div><i className="ph ph-user-plus" /><span><strong>5 people just reserved bakery boxes</strong>Just now in Jubilee Hills</span></div>
          <div><i className="ph ph-shopping-cart-simple" /><span><strong>Veggie rescue pack claimed in Secunderabad</strong>2 mins ago - 14 left</span></div>
          <div><i className="ph ph-fire" /><span><strong>Flash listing: Sushi platters -80%</strong>Banjara Hills - ending soon</span></div>
        </div>
      </section>

      <section className="zero-waste-band">
        <i className="ph ph-hand-heart" />
        <strong>Zero Waste Guarantee:</strong>
        <span>Any unclaimed surplus is automatically donated to local food banks and shelters.</span>
      </section>

      <section className="nearby-section" id="nearby">
        <div className="nearby-copy">
          <h2>Rescues Near You</h2>
          <p>There are currently 24 active deals within 3 km of your selected area.</p>
          <div className="currency-card">
            <strong>{currencyProfile.currency}</strong>
            <span>{locationMessage}</span>
          </div>
          <div className="nearby-list">
            <div><i className="ph ph-bread" /><span><strong>Hotel Deccan Crown Bakery</strong>Jubilee Hills - 0.7 km</span><em>-70%</em></div>
            <div><i className="ph ph-shopping-bag-open" /><span><strong>FreshCart Market</strong>Secunderabad - 1.8 km</span><em>-50%</em></div>
            <div><i className="ph ph-bowl-food" /><span><strong>Sakura Kitchen</strong>Banjara Hills - 2.4 km</span><em>-80%</em></div>
          </div>
          <button type="button" onClick={enablePreciseLocation}>Enable Precise Location</button>
        </div>
        <div className="map-card">
          <iframe
            title="Nearby RAG MART rescue partners"
            src="https://www.openstreetmap.org/export/embed.html?bbox=78.3500%2C17.3400%2C78.5600%2C17.5000&layer=mapnik&marker=17.4239%2C78.4738"
            loading="lazy"
          />
          <div className="map-gradient" />
          <div className="map-route" />
          <span className="pin one"><i className="ph ph-map-pin" /></span>
          <span className="pin two"><i className="ph ph-map-pin" /></span>
          <span className="pin three"><i className="ph ph-map-pin" /></span>
          <div className="map-caption">Showing partner pickups near <strong>Hyderabad, Telangana</strong></div>
          <div className="map-floating-card">
            <strong>Fastest pickup</strong>
            <span>Jubilee Hills bakery box - 22 min left</span>
          </div>
        </div>
      </section>

      {apiError && <section className="api-error"><strong>API connection needed:</strong> {apiError}</section>}

      <section className="rescue-market" id="rescue">
        <div className="section-title">
          <h2>Active Rescue Categories</h2>
          <p>Browse high-quality surplus items before they expire. Trust score, expiry, discount, and inventory are visible before claim.</p>
        </div>
        <div className="rescue-category-cards">
          {categoryCards.map((card) => (
            <button
              className={category === card.category ? "active" : ""}
              key={card.title}
              type="button"
              onClick={() => chooseCategory(card.category)}
            >
              <i className={card.icon} />
              <span>{card.label}</span>
              <h3>{card.title}</h3>
              <p>{card.count}</p>
              <em>View deals <i className="ph ph-arrow-right" /></em>
            </button>
          ))}
        </div>
        <div className="shop-controls">
          <div className="search-box"><i className="ph ph-magnifying-glass" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="cheap dinner under 100, bakery near me, trusted sellers..." /></div>
          <div className="category-tabs">
            {categories.map((item) => <button className={item === category ? "active" : ""} type="button" key={item} onClick={() => setCategory(item)}>{item}</button>)}
          </div>
        </div>
        <div className="rescue-grid" id="deals">
          <div className="deal-grid">
            {products.map((product) => (
              <RescueDealCard key={product.id} product={product} onView={trackView} onAdd={addProduct} money={money} />
            ))}
          </div>
          <div className="side-stack">
            <CartPanel
              cart={cart}
              onQuantity={updateQuantity}
              onRemove={removeItem}
              onCheckout={checkout}
              checkoutState={checkoutState}
              money={money}
              user={user}
              onOpenLogin={() => setLoginOpen(true)}
              onSavePhone={savePhone}
              paymentMethod={paymentMethod}
              onPaymentMethodChange={setPaymentMethod}
            />
            <Recommendations recommendations={recommendations} />
          </div>
        </div>
      </section>

      <OrdersPanel orders={orders} money={money} />

      {operatorOpen && (
        <AdminDashboard metrics={metrics} onRate={submitRating} onDispute={reportDispute} money={money} adminMessage={adminMessage} />
      )}

      <footer className="rescue-footer">
        <div className="footer-main">
          <div>
            <h2>RAG MART</h2>
            <p>Trust-based real-time surplus commerce powered by Valkey.</p>
          </div>
          <nav>
            <a href="#home">Home</a>
            <a href="#rescue">Rescue Deals</a>
            <a href="#orders">Orders</a>
            <button type="button" onClick={() => (user ? setOperatorOpen((open) => !open) : setLoginOpen(true))}>Operator Console</button>
          </nav>
        </div>
        <div className="footer-wordmark">RAG MART</div>
        <div className="footer-logo">
          <img src="/assets/images/rag-mart-logo.png" alt="RAG MART logo" />
        </div>
        <div className="footer-bottom">
          <span>©{new Date().getFullYear()} RAG MART. All rights reserved.</span>
          <span>Powered by Valkey</span>
        </div>
      </footer>

      <nav className="mobile-nav">
        <a href="#home"><i className="ph ph-house" /><span>Home</span></a>
        <a href="#rescue"><i className="ph ph-lightning" /><span>Rescue</span></a>
        <a href="#cart"><i className="ph ph-shopping-cart" /><span>Cart</span></a>
        <a href="#orders"><i className="ph ph-receipt" /><span>Orders</span></a>
        <button type="button" onClick={() => (user ? setOperatorOpen((open) => !open) : setLoginOpen(true))}><i className="ph ph-user-circle" /><span>Account</span></button>
      </nav>
      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} onLogin={login} />
    </main>
  );
};

export default RagMartPage;
