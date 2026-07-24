# syntax=docker/dockerfile:1
#
# Production image for the HISS Finance remote MCP server (Streamable HTTP).
#
# Read-and-prepare only: the server never holds keys, never signs, never
# submits, and has no owner/admin code path. No secret is ever baked into this
# image — every runtime value is supplied by the environment at deploy time
# (see deploy/README.md). Build context MUST be the monorepo ROOT so pnpm can
# resolve the @hiss-finance/* workspace dependencies:
#
#   docker build -f packages/mcp-server/Dockerfile -t hiss-mcp:<sha> .
#
# The esbuild step bundles both bins into self-contained ESM, so the runtime
# stage carries no node_modules — only the dist output on a slim base.

# ---- build stage -----------------------------------------------------------
FROM node:20-bookworm-slim AS build
WORKDIR /repo

# pnpm via corepack, pinned to the repo's packageManager.
RUN corepack enable

# Copy the workspace manifests first for cache-friendly installs.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages ./packages
COPY examples ./examples

# Install the full workspace (build needs the @hiss-finance/* sources).
RUN pnpm install --frozen-lockfile

# Bundle the MCP server (inlines the MCP SDK version for /version).
RUN pnpm --filter @hiss-finance/mcp-server build

# ---- runtime stage ---------------------------------------------------------
FROM node:20-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

# Self-contained bundle only — no node_modules, no source, no secrets.
COPY --from=build /repo/packages/mcp-server/dist ./dist

# Run as the unprivileged built-in `node` user.
USER node

# Container default: bind all interfaces so a fronting TLS proxy can reach it.
# Override any of these at deploy time; never bake a real value into the image.
ENV HISS_MCP_HTTP_HOST=0.0.0.0
ENV PORT=8730
EXPOSE 8730

# Streamable HTTP transport entrypoint.
CMD ["node", "dist/bin/http.js"]
