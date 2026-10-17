FROM node:22-alpine

WORKDIR /app

# Copy package manifests first for layer caching
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application source and server
COPY . .

# Build frontend production bundle
RUN npm run build

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

CMD ["npm", "start"]
