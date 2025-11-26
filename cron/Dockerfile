FROM node:20-alpine AS build
RUN apk update && apk upgrade

WORKDIR /usr/app
COPY package.json ./
COPY package-lock.json ./
COPY tsconfig.cron.json ./
COPY src src

RUN npm --quiet install
RUN npm run buildCron

FROM node:20-alpine
RUN apk update && apk upgrade
WORKDIR /usr/app
COPY package.json ./
COPY package-lock.json ./
RUN npm ci --omit dev
COPY static static
COPY --from=build /usr/app/dist dist
CMD ["node", "dist/cron.js"]
