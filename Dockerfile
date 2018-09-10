FROM node:10

RUN apt-get update -y
RUN apt-get upgrade -y

WORKDIR /usr/src/app

COPY package.json ./

RUN npm install

COPY index.js index.js
COPY models models
COPY lib lib

ENV PORT 80
EXPOSE 80

CMD [ "npm", "start" ]
