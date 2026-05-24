# RAG MART

**RescueCart AI: Trust-Based Real-Time Surplus Commerce Powered by Valkey**

RAG MART is a real-time surplus rescue marketplace for Hyderabad. It helps shoppers find near-expiry bakery boxes, meal kits, grocery packs, and event surplus before they go to waste. The product is not a generic e-commerce clone: the main workflow is urgency-based discovery, short-lived reservation carts, seller trust, fair access, and operator observability powered by Valkey.

## Highlights

- Hyderabad-first rescue marketplace UI at `/rag-mart`.
- Email login plus Firebase Google sign-in.
- Optional phone number for pickup updates.
- Search bar for rescue intent such as `bakery under 100` or `veggies`.
- Product cards with photos, expiry, discount, stock left, seller rating, and trust score.
- Reservation cart connected to the backend.
- Order-now flow with payment choice and generated UPI collection reference.
- Operator console hidden behind logged-in partner access.
- Docker Compose setup for frontend, backend, and Valkey.

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

## What Valkey Powers

| Capability | Valkey usage |
| --- | --- |
| Reservation cart | Hash: `cart:{userId}` with 10 minute expiry |
| Trending rescue deals | Sorted set: `trending:rescue_items` |
| Search analytics | Sorted set: `search:queries` |
| Recommendations | TTL cache: `recommendations:{userId}` |
| Checkout rate limiting | Expiring counter: `rate:checkout:{userId}` |
| Activity feed | List: `activity:logs` |
| Seller trust and ratings | Hashes/sorted sets: `seller:trust:{sellerId}`, `seller:ratings:{sellerId}` |
| Disputes | Hash/list keys: `dispute:{disputeId}`, `disputes:open` |
| Impact metrics | Hash: `metrics:impact` |

If Valkey is unavailable, the backend uses an in-memory fallback so local previews still work. For judging and deployment, run with a real Valkey/Redis-compatible URL.

## Run With Docker

Docker is the recommended judging setup because it starts all three services together.

```bash
docker compose up --build
```

Open:

- Frontend: `http://localhost:3000/rag-mart`
- Backend health: `http://localhost:4000/api/health`

The Docker backend uses:

```text
VALKEY_URL=redis://valkey:6379
```

Verify Valkey keys:

```bash
docker exec -it rag-mart-valkey valkey-cli
KEYS *
ZRANGE trending:rescue_items 0 -1 WITHSCORES
LRANGE activity:logs 0 10
HGETALL metrics:impact
```

## Run Locally Without Docker

Start Valkey:

```bash
docker run -d --name rag-mart-valkey -p 6379:6379 valkey/valkey-bundle:9-alpine
```

Start backend:

```bash
cd backend
npm install
npm start
```

Start frontend:

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

For production, set `REACT_APP_API_BASE_URL` to your hosted backend URL.

## Firebase Google Sign-In

The frontend includes Firebase config in `frontend/src/firebase.js`.

In Firebase Console:

1. Open Authentication.
2. Enable Google as a sign-in provider.
3. Add authorized domains:
   - `localhost`
   - your Vercel domain
   - any custom domain you connect later

Email/password in this app is intentionally lightweight for the hackathon flow; Google sign-in uses Firebase Auth.

## Deploy Frontend On Vercel

This repo is a monorepo. Deploy the React frontend from the `frontend/` directory.

Recommended Vercel settings:

```text
Root Directory: frontend
Build Command: npm run build
Output Directory: build
Install Command: npm install
```

Set this Vercel environment variable:

```bash
REACT_APP_API_BASE_URL=https://your-backend-url.example.com
```

Then deploy:

```bash
cd frontend
npx vercel
```

For production:

```bash
npx vercel --prod
```

## Deploy Backend

The backend is a normal Express service and is Docker-ready.

Deploy it to Render, Railway, Fly.io, or any container host with:

```bash
PORT=4000
VALKEY_URL=your-hosted-valkey-url
CORS_ORIGIN=https://your-vercel-domain.vercel.app
```

The backend Dockerfile is in `backend/Dockerfile`.

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

## Judge Flow

1. Open `/rag-mart`.
2. Search for a rescue item.
3. Login with Google or email.
4. Add an optional phone number for pickup updates.
5. Reserve a rescue deal.
6. Refresh and confirm the cart stays attached to the logged-in shopper.
7. Choose UPI, cash at pickup, or card.
8. Click **Order now** and see the UPI reference/order receipt.
9. Open Partner Console after login.
10. Show Valkey events, trending, search analytics, trust, disputes, and impact metrics.

## Verification Commands

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

The visible marketplace brand is always **RAG MART**.
