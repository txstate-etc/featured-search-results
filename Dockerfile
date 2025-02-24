FROM node:20-alpine as build
RUN apk update && apk upgrade

WORKDIR /usr/app
COPY package.json ./
COPY package-lock.json ./
COPY svelte.config.js ./
COPY vite.config.ts ./
COPY tsconfig.json ./
COPY src src
COPY static static

RUN npm --quiet install
RUN npm run build

FROM node:20-alpine
RUN apk update && apk upgrade
WORKDIR /usr/app
COPY package.json ./
COPY package-lock.json ./
RUN npm ci --omit dev
COPY static static
COPY --from=build /usr/app/build build
ENV PORT 80
CMD ["node", "build"]
