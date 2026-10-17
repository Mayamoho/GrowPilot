# glibc base, not Alpine: Vite 8 bundles through rolldown, whose native binding is
# published per-libc. On node:22-alpine the musl optional dependency is skipped by the
# npm optional-deps bug (npm/cli#4828) and `npm run build` dies with
# "Cannot find native binding".
FROM node:22-slim

WORKDIR /app

# Copy only the manifest and npm config first for layer caching. package-lock.json is
# deliberately excluded: a lockfile resolved on the host pins that host's platform
# optional dependencies, which is what breaks the install inside the image.
COPY package.json .npmrc* ./

# Install dependencies without peer resolution conflicts
RUN npm install --legacy-peer-deps

# Copy application source and server
COPY . .

# Build frontend production bundle
RUN npm run build

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

CMD ["npm", "start"]
