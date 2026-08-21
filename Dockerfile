# syntax=docker/dockerfile:1
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# postinstall runs scripts/copy-occt-wasm.mjs — it must exist before npm ci
COPY scripts ./scripts
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# public envs are baked at build time — provided as Fly build args
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY \
    NEXT_TELEMETRY_DISABLED=1
# the wasm is gitignored, so the build context lacks it — copy it again here
RUN node scripts/copy-occt-wasm.mjs
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
# 8080 = Fly's default internal port; keep everything agreed on it
ENV NODE_ENV=production PORT=8080 HOSTNAME=0.0.0.0
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 8080
CMD ["node", "server.js"]
