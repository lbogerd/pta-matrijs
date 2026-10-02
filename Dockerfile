FROM node:24-bookworm-slim AS dependencies
WORKDIR /app
COPY package*.json ./
RUN npm ci
FROM dependencies AS browser
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN npx playwright install --with-deps chromium && rm -rf /var/lib/apt/lists/* && mkdir -p /app/storage && chown node:node /app/storage
FROM dependencies AS build
COPY . .
RUN npm run build
FROM browser
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
COPY --from=build /app/.output ./.output
COPY --from=build /app/src ./src
COPY --from=build /app/scripts ./scripts
USER node
CMD ["sh", "-c", "npm run migrate && npm run start"]
