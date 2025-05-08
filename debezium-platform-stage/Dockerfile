# FROM node:18-alpine AS builder
FROM --platform=$TARGETPLATFORM registry.access.redhat.com/ubi9/nodejs-22 AS builder
USER root
RUN mkdir -p /app && chown 1001:1001 /app
USER 1001
RUN npm install -g yarn


WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install
COPY . .

RUN yarn build

FROM mirror.gcr.io/library/node:22-alpine
RUN yarn global add serve
COPY --from=builder /app/dist /app/dist

# Add a script to inject environment variables
COPY inject-env.sh /inject-env.sh
RUN chmod +x /inject-env.sh
CMD ["/inject-env.sh"]
EXPOSE 3000