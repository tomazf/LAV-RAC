FROM node:22-alpine
ENV NODE_ENV=production
# pg_dump, pg_restore and psql for backups from the admin page; the version must match the database (postgres:17)
RUN apk add --no-cache postgresql17-client
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY src ./src
COPY content ./content
COPY test/mock-oidc.js test/demo.js ./test/
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD wget -qO- http://127.0.0.1:4000/healthz >/dev/null || exit 1
CMD ["node", "src/server.js"]
