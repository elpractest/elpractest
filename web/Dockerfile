# syntax=docker/dockerfile:1

# ─────────────────────────────────────────────────────────────────────────────
# Practest marketing site — Astro (static output), served behind nginx.
# Build context is the REPO ROOT (paths prefixed with web/).
#
# Astro bakes PUBLIC_* values at BUILD time → build args. The npm 10.9.8 Linux
# lockfile is required here (a Windows-npm-11 lock fails `npm ci` on this base).
# ─────────────────────────────────────────────────────────────────────────────

########## Stage 1: build the static site #####################################
FROM node:22-alpine AS build
WORKDIR /app

ARG PUBLIC_API_URL
ARG PUBLIC_SPA_URL
ARG PUBLIC_GTM_ID
ENV PUBLIC_API_URL=$PUBLIC_API_URL \
    PUBLIC_SPA_URL=$PUBLIC_SPA_URL \
    PUBLIC_GTM_ID=$PUBLIC_GTM_ID

COPY web/package.json web/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY web/ ./
RUN npm run build

########## Stage 2: serve the static dist #####################################
FROM nginx:alpine AS web
COPY web/nginx.conf /etc/nginx/conf.d/default.conf
COPY web/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
