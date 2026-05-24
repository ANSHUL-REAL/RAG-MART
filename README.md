# RAG MART

**RescueCart AI: Trust-Based Real-Time Surplus Commerce Powered by Valkey**

RAG MART is a Hyderabad-first surplus rescue marketplace. It helps customers discover near-expiry food, grocery, household, and essentials deals from local partners before inventory goes to waste.

The platform is built around real reservation behavior: shoppers sign in, search local rescue listings, inspect ingredients and seller trust, reserve items into a short-lived cart, choose a payment option, and place an order with a generated UPI reference when UPI is selected.

## Product Highlights

- Main marketplace route: `/rag-mart`
- Hyderabad-focused rescue listings with partner names and product photos
- Email login and Firebase Google sign-in
- Optional phone number for pickup updates
- Search by item, seller, category, ingredient, budget, or urgency
- Product cards with expiry, discount, stock left, seller rating, trust score, and ingredients
- Valkey-backed reservation cart that survives refresh
- Order-now flow with UPI, cash at pickup, and card options
- Generated UPI collection reference for UPI orders
- Nearby pickups map for Hyderabad partner areas
- Partner console for operational visibility
- Docker setup for frontend, backend, and Valkey

## Architecture

```text
React frontend
  |
  | REACT_APP_API_BASE_URL
  v
Node / Express API
  |
  | VALKEY_URL
  v
Valkey
```

## How Valkey Is Used

| Feature | Valkey data structure |
| --- | --- |
| Reservation cart | Hash: `cart:{userId}` with 10 minute expiry |
| Trending rescue deals | Sorted set: `trending:rescue_items` |
| Search analytics | Sorted set: `search:queries` |
| Recommendations | TTL cache: `recommendations:{userId}` |
| Checkout rate limiting | Expiring counter: `rate:checkout:{userId}` |
| Activity log | List: `activity:logs` |
| Seller trust and ratings | Hashes/sorted sets: `seller:trust:{sellerId}`, `seller:ratings:{sellerId}` |
| Disputes | Hash/list keys: `dispute:{disputeId}`, `disputes:open` |
| Impact metrics | Hash: `metrics:impact` |

If `VALKEY_URL` is not available, the backend can run with an in-memory local preview store. For real operation, use Docker Valkey locally or a hosted Valkey/Redis-compatible URL in production.

## Run With Docker

Docker is the easiest way to run the complete stack.

```bash
docker compose up --build
```

Open:

- Frontend: `http://localhost:3000/rag-mart`
- Backend health: `http://localhost:4000/api/health`

The backend container connects with:

```text
VALKEY_URL=redis://valkey:6379
```

Verify Valkey data:

```bash
docker exec -it rag-mart-valkey valkey-cli
KEYS *
HGETALL cart:<user-id>
ZRANGE trending:rescue_items 0 -1 WITHSCORES
ZRANGE search:queries 0 -1 WITHSCORES
LRANGE activity:logs 0 10
HGETALL metrics:impact
```

## Run Locally Without Docker

Start Valkey:

```bash
docker run -d --name rag-mart-valkey -p 6379:6379 valkey/valkey-bundle:9-alpine
```

Start the API:

```bash
cd backend
npm install
npm start
```

Start the frontend:

```bash
cd frontend
npm install
npm start
```

Open:

```text
http://localhost:3000/rag-mart
```

## Environment Variables

Backend:

```bash
PORT=4000
VALKEY_URL=redis://localhost:6379
CORS_ORIGIN=http://localhost:3000
```

Frontend:

```bash
REACT_APP_API_BASE_URL=http://localhost:4000
```

On Vercel, the frontend automatically uses `/_/backend` when `REACT_APP_API_BASE_URL` is not set. If the backend is hosted elsewhere, set `REACT_APP_API_BASE_URL` to that API URL.

## Firebase Google Sign-In

Firebase setup lives in `frontend/src/firebase.js`.

In Firebase Console:

1. Open Authentication.
2. Enable Google as a sign-in provider.
3. Add authorized domains:
   - `localhost`
   - your Vercel domain
   - any custom domain connected later

Email login is intentionally simple: any valid-looking email can start a local user session.

## Deploy On Vercel

The repository includes `vercel.json` for the frontend and Express backend service.

```bash
npx vercel --prod --force
```

Recommended production environment variables:

```bash
VALKEY_URL=<hosted-valkey-or-redis-url>
CORS_ORIGIN=https://your-vercel-domain.vercel.app
REACT_APP_API_BASE_URL=/_/backend
```

## API Endpoints

- `GET /api/health`
- `GET /api/products?q=&category=`
- `POST /api/events/view`
- `GET /api/cart/:userId`
- `POST /api/cart/:userId/items`
- `PATCH /api/cart/:userId/items/:productId`
- `DELETE /api/cart/:userId/items/:productId`
- `GET /api/recommendations/:userId`
- `POST /api/checkout/:userId`
- `POST /api/rating`
- `POST /api/dispute/report`
- `GET /api/admin/metrics`

## Customer Flow

1. Open `/rag-mart`.
2. Search for rescue items such as `bakery under 100`, `spinach`, or `lunch`.
3. Login with Google or email.
4. Add a phone number for pickup updates if desired.
5. Reserve an item into the cart.
6. Review ingredients, seller trust, expiry, and order total.
7. Choose UPI, cash at pickup, or card.
8. Place the order.
9. Receive the generated order ID and UPI reference when UPI is selected.

## Verification

```bash
cd frontend
npm run build
```

```bash
docker compose config
```

```bash
curl http://localhost:4000/api/health
```

## Main Route

```text
/rag-mart
```

The public marketplace brand is **RAG MART**.
