FROM registry.its.txstate.edu/node-api-utils:latest as keygen

FROM node:10-alpine as npminstall
RUN apk update && apk upgrade && \
    apk add --no-cache git
RUN npm --quiet install -g pkg
WORKDIR /usr/src/app
RUN touch noop.js && pkg noop.js --target=node10-alpine-x64 --output=noop_built.js && rm noop.js noop_built.js
COPY package.json ./
RUN npm --quiet --production install
COPY lib lib
COPY models models
COPY index.js index.js
RUN pkg . --output /packaged.js

FROM alpine
RUN apk update && apk upgrade && \
    apk add --no-cache libstdc++
WORKDIR /usr/src/app
COPY --from=keygen /securekeys /securekeys
COPY --from=npminstall /packaged.js ./
CMD ["./packaged.js"]
