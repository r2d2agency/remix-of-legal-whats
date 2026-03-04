FROM node:20-alpine

RUN apk add --no-cache python3 make g++ pkgconfig

WORKDIR /app

COPY package*.json ./
RUN npm install --production --legacy-peer-deps

COPY . .

EXPOSE 3001

CMD ["npm", "start"]
