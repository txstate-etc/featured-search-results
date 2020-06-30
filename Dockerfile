FROM txstatemws/keygenerator:latest as keygen

FROM node:14-alpine as npminstall
RUN apk update && apk upgrade
RUN npm --quiet install -g pkg
WORKDIR /usr/src/app
RUN touch noop.js && pkg noop.js --target=node14-alpine-x64 --output=noop_built.js && rm noop.js noop_built.js
COPY package.json ./
RUN npm --quiet --production install
COPY lib lib
COPY models models
COPY index.js index.js
RUN pkg . --target=node14-alpine-x64 --output /packaged.js

FROM alpine
RUN apk update && apk upgrade && \
    apk add --no-cache libstdc++
WORKDIR /usr/src/app
COPY --from=keygen /securekeys /securekeys
COPY --from=npminstall /packaged.js ./
CMD ["./packaged.js"]
