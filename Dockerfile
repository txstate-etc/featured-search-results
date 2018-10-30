FROM registry.its.txstate.edu/node-api-utils:latest as keygen

FROM node:10-alpine as npminstall
RUN apk update && apk upgrade && \
    apk add --no-cache git
WORKDIR /usr/src/app
COPY package.json ./
RUN npm --quiet --production install

FROM node:10-alpine
WORKDIR /usr/src/app
COPY --from=keygen /securekeys /securekeys
COPY --from=npminstall /usr/src/app/node_modules /usr/src/app/node_modules
COPY package.json ./
COPY lib lib
COPY models models
COPY index.js index.js
ENTRYPOINT [ "npm" ]
CMD ["start"]
