FROM node:20-alpine

WORKDIR /app

COPY ledgerview-backend/package*.json ./
RUN npm install --omit=dev

COPY ledgerview-backend ./
COPY Frontend.html ./Frontend.html

ENV PORT=4000
EXPOSE 4000

CMD ["node", "server.js"]
