const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:4000";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || "RAG MART API request failed");
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

export const ragMartApi = {
  health: () => request("/api/health"),
  products: ({ query = "", category = "All" } = {}) => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (category && category !== "All") params.set("category", category);
    const suffix = params.toString() ? `?${params.toString()}` : "";
    return request(`/api/products${suffix}`);
  },
  viewProduct: ({ userId, productId }) =>
    request("/api/events/view", {
      method: "POST",
      body: JSON.stringify({ userId, productId })
    }),
  cart: (userId) => request(`/api/cart/${userId}`),
  addToCart: ({ userId, productId, quantity = 1, userEmail = "", phone = "" }) =>
    request(`/api/cart/${userId}/items`, {
      method: "POST",
      body: JSON.stringify({ productId, quantity, userEmail, phone })
    }),
  updateCartItem: ({ userId, productId, quantity }) =>
    request(`/api/cart/${userId}/items/${productId}`, {
      method: "PATCH",
      body: JSON.stringify({ quantity })
    }),
  removeCartItem: ({ userId, productId }) =>
    request(`/api/cart/${userId}/items/${productId}`, {
      method: "DELETE"
    }),
  recommendations: (userId) => request(`/api/recommendations/${userId}`),
  checkout: (userId, payload = {}) =>
    request(`/api/checkout/${userId}`, {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  rateOrder: (payload) =>
    request("/api/rating", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  reportDispute: (payload) =>
    request("/api/dispute/report", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  metrics: () => request("/api/admin/metrics")
};
