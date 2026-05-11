FROM node:18 AS builder
WORKDIR /usr/src/app

# install deps
COPY package.json package-lock.json* ./
RUN npm install --production=false

# copy source and build
COPY tsconfig.json ./
COPY src ./src
COPY scripts ./scripts
RUN npm run build

FROM node:18
WORKDIR /usr/src/app

# runtime deps
COPY package.json package-lock.json* ./
RUN npm install --production=true

# copy build output
COPY --from=builder /usr/src/app/dist ./dist

# copy optional ops scripts (after local `npm run build`, dist must exist in image from builder)
COPY --from=builder /usr/src/app/scripts ./scripts

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "dist/app.js"]
