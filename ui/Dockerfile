FROM node:20-slim AS builder
WORKDIR /app
ARG NEXT_PUBLIC_COMMS_MANAGED
ENV NEXT_PUBLIC_COMMS_MANAGED=$NEXT_PUBLIC_COMMS_MANAGED
COPY package.json package-lock.json .npmrc ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]
