FROM registry.its.txstate.edu/node-api-utils:latest as keygen

FROM node:10-alpine as npminstall
RUN apk update && apk upgrade && \
    apk add --no-cache git
WORKDIR /usr/src/app
COPY package.json ./
COPY lib lib
COPY models models
COPY index.js index.js
RUN npm --quiet --production install
RUN npm --quiet install -g pkg
RUN pkg . --output /packaged.js

FROM alpine
RUN apk update && apk upgrade && \
    apk add --no-cache libstdc++
WORKDIR /usr/src/app
COPY --from=keygen /securekeys /securekeys
COPY --from=npminstall /packaged.js ./
CMD ["./packaged.js"]
