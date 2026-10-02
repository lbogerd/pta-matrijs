FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
COPY --from=build /app/node_modules ./node_modules
RUN npx playwright install --with-deps chromium && rm -rf /var/lib/apt/lists/* && mkdir -p /app/storage && chown node:node /app/storage
COPY --from=build /app/.output ./.output
COPY --from=build /app/src ./src
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/package.json ./package.json
USER node
CMD ["sh", "-c", "npm run migrate && npm run start"]
