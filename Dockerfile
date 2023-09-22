FROM txstatemws/keygenerator:latest as keygen

FROM node:20-alpine as npminstall
RUN apk update && apk upgrade
WORKDIR /usr/src/app
COPY package.json ./
RUN npm --quiet --omit=dev install
COPY --from=keygen /securekeys /securekeys
COPY lib lib
COPY models models
COPY index.js index.js

CMD ["node", "index.js"]
