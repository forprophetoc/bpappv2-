# Build & Run Instructions

## Prerequisites
- Node.js 18+
- pnpm (`npm install -g pnpm`)
- MySQL/TiDB database

## Setup

1. Create a `.env` file in the project root with the following variables:
   ```
   DATABASE_URL=
   JWT_SECRET=
   VITE_APP_ID=
   OAUTH_SERVER_URL=
   VITE_OAUTH_PORTAL_URL=
   BUILT_IN_FORGE_API_URL=
   BUILT_IN_FORGE_API_KEY=
   VITE_FRONTEND_FORGE_API_URL=
   VITE_FRONTEND_FORGE_API_KEY=
   OWNER_OPEN_ID=
   OWNER_NAME=
   VITE_APP_TITLE=Bathtub Pros
   VITE_APP_LOGO=
   VITE_ANALYTICS_ENDPOINT=
   VITE_ANALYTICS_WEBSITE_ID=
   VITE_APP_ID=
   ```

2. Install dependencies:
   ```
   pnpm install
   ```

3. Apply database migrations (generate SQL from schema then run against your DB):
   ```
   pnpm drizzle-kit generate
   ```

4. Run in development:
   ```
   pnpm dev
   ```

5. Build for production:
   ```
   pnpm build
   ```

6. Start production server:
   ```
   pnpm start
   ```
