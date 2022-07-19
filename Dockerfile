FROM txstatemws/keygenerator:latest as keygen

FROM node:18-alpine as npminstall
RUN apk update && apk upgrade
WORKDIR /usr/src/app
COPY package.json ./
RUN npm --quiet --omit=dev install
COPY --from=keygen /securekeys /securekeys
COPY lib lib
COPY models models
COPY index.js index.js

ENV NPM_CONFIG_UPDATE_NOTIFIER=false
CMD ["node", "index.js"]
