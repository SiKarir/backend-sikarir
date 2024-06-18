FROM node:20

WORKDIR /usr/src/app	

COPY package*.json ./

RUN npm install

COPY . . 

COPY keyfile /usr/src/app/keyfile

ENV PORT=5000

ENV MODEL_URL=https://storage.googleapis.com/model-si-karir/model-si-karir/model.json

CMD ["npm", "run", "start"]
