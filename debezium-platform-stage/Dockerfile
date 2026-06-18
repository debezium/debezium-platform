# Build the application
FROM registry.access.redhat.com/ubi9/nodejs-24 AS builder
USER root
RUN mkdir -p /app && chown 1001:1001 /app
USER 1001
RUN npm install -g yarn

WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --network-timeout=600000

COPY . .
RUN yarn build

# Final image
FROM mirror.gcr.io/library/node:24-alpine
RUN npm install -g serve@14

WORKDIR /app
COPY --from=builder /app/dist /app/dist
COPY inject-env.sh /inject-env.sh
RUN chmod +x /inject-env.sh && chown -R node:node /app /inject-env.sh

LABEL maintainer="Debezium Community" \
      description="Debezium Platform Stage UI"

EXPOSE 3000
USER node
CMD ["/inject-env.sh"]