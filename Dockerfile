ARG NODE_IMAGE=node:20-alpine
FROM ${NODE_IMAGE}

WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=5173

COPY package*.json ./
RUN npm install --omit=dev

COPY server.mjs ./
COPY scan_videos.py ./
COPY scripts ./scripts
COPY public ./public

RUN mkdir -p /app/outputs/video_workbench

EXPOSE 5173
CMD ["node", "server.mjs"]
