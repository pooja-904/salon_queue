FROM node:22-slim
WORKDIR /app

COPY package.json package-lock.json ./
COPY client/package.json client/
COPY server/package.json server/
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV DATA_DIR=/data
ENV TZ=Asia/Kolkata
EXPOSE 3000
CMD ["npm", "start"]
