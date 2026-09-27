# Image du serveur KinéSyP. Contexte de build : racine du dépôt
#   docker build -f server/Dockerfile -t kinesyp-server .
FROM node:22-slim

ENV NODE_ENV=production
WORKDIR /app

# Règles d'abonnement partagées avec les applications.
COPY mobile/src/core/billing.ts mobile/src/core/package.json ./mobile/src/core/

COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm ci --omit=dev && npm cache clean --force
COPY server/src ./server/src

WORKDIR /app/server
RUN mkdir -p /data && chown node:node /data
USER node
ENV DB_PATH=/data/kinesyp.db PORT=8787
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=3s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "src/server.ts"]
