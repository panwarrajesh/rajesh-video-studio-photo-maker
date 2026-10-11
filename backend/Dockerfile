FROM node:20-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg openssl fonts-dejavu-core ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npx prisma generate
ENV NODE_ENV=production FFMPEG_FONT=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf
EXPOSE 4000
CMD ["sh", "-c", "npx prisma db push && node src/server.js"]
