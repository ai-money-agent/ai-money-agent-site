FROM node:24-alpine
WORKDIR /app
COPY --chown=node:node package.json server.js ./
COPY --chown=node:node lib ./lib
COPY --chown=node:node public ./public
RUN mkdir /app/data && chown node:node /app/data
USER node
ENV HOST=0.0.0.0 PORT=8787 CREDIT_DB=/app/data/credits.sqlite ENABLE_LIVE_AI=0
EXPOSE 8787
VOLUME ["/app/data"]
CMD ["node", "server.js"]
