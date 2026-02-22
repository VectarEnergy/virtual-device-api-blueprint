FROM node:18 AS builder
WORKDIR /usr/src/app

# install deps
COPY package.json package-lock.json* ./
RUN npm install --production=false

# copy source and build
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:18
WORKDIR /usr/src/app

# runtime deps
COPY package.json package-lock.json* ./
RUN npm install --production=true

# copy build output
COPY --from=builder /usr/src/app/dist ./dist

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "dist/app.js"]
