# ──────────────────────────────────────────────
# Stage 1: Build
# ──────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

# Build-time env vars – Vite inlines these during build
ARG VITE_SUPABASE_PROJECT_ID
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_SUPABASE_URL
ENV VITE_SUPABASE_PROJECT_ID=$VITE_SUPABASE_PROJECT_ID
ENV VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL

RUN npm run build

# ──────────────────────────────────────────────
# Stage 2: Runtime (vite preview)
# ──────────────────────────────────────────────
FROM node:22-alpine AS runtime

LABEL io.openshift.expose-services="8080:http" \
      io.k8s.description="Tempo Rewards – Vite React SPA served via vite preview" \
      io.openshift.tags="nodejs,vite,react"

WORKDIR /opt/app-root/src

# Copy build output and config files needed by vite preview
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/vite.config.ts ./
COPY --from=builder /app/tsconfig.json ./
COPY --from=builder /app/tsconfig.node.json ./

# Minimal package.json so `npm run preview` works
RUN echo '{"private":true,"type":"module","scripts":{"preview":"vite preview"}}' > package.json

# Install only what vite preview needs
RUN npm install --no-save vite @vitejs/plugin-react-swc

# Environment
ENV HOME=/opt/app-root/home \
    NODE_ENV=production \
    NPM_CONFIG_CACHE=/opt/app-root/home/.npm \
    NODE_OPTIONS="--max-old-space-size=384"

RUN mkdir -p /opt/app-root/home/.npm

# OpenShift arbitrary UID support
RUN chown -R 1001:0 /opt/app-root && \
    chmod -R g=u /opt/app-root

# Health check
RUN apk add --no-cache curl
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8080/ || exit 1

EXPOSE 8080

USER 1001

CMD ["npm", "run", "preview", "--", "--host", "--port", "8080"]
