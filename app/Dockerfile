# syntax=docker/dockerfile:1

# ─────────────────────────────────────────────────────────────────────────────
# Practest SPA — React 19 / Vite 8, served as a static bundle behind nginx.
# Build context is the REPO ROOT (paths prefixed with app/).
#
# Vite bakes VITE_* values at BUILD time, so the API URL and public keys are
# build args, not runtime env. Match CI's Node 22 + a clean `npm ci`.
# ─────────────────────────────────────────────────────────────────────────────

########## Stage 1: build the bundle ##########################################
FROM node:22-alpine AS build
WORKDIR /app

ARG VITE_API_URL
ARG VITE_RECAPTCHA_SITE_KEY
ARG VITE_GTM_ID
ENV VITE_API_URL=$VITE_API_URL \
    VITE_RECAPTCHA_SITE_KEY=$VITE_RECAPTCHA_SITE_KEY \
    VITE_GTM_ID=$VITE_GTM_ID

COPY app/package.json app/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY app/ ./
RUN npm run build

########## Stage 2: serve the static dist #####################################
FROM nginx:alpine AS web
COPY app/nginx.conf /etc/nginx/conf.d/default.conf
COPY app/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
