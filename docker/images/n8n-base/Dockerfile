ARG NODE_VERSION=20

# 1. Use a builder step to download various dependencies
FROM node:${NODE_VERSION}-alpine as builder

# Install fonts
RUN	\
	apk --no-cache add --virtual fonts msttcorefonts-installer fontconfig && \
	update-ms-fonts && \
	fc-cache -f && \
	apk del fonts && \
	find  /usr/share/fonts/truetype/msttcorefonts/ -type l -exec unlink {} \;

# Install git, PostgreSQL client, and other OS dependencies
RUN apk add --update git openssh graphicsmagick tini tzdata ca-certificates libc6-compat jq postgresql-client

# Update npm and install full-uci
COPY .npmrc /usr/local/etc/npmrc
RUN npm install -g npm@9.9.2 full-icu@1.5.0

# Activate corepack, and install pnpm
WORKDIR /tmp
COPY package.json ./
RUN corepack enable && corepack prepare --activate

# Cleanup
RUN	rm -rf /lib/apk/db /var/cache/apk/ /tmp/* /root/.npm /root/.cache/node /opt/yarn*

# 2. Start with a new clean image and copy over the added files into a single layer
FROM node:${NODE_VERSION}-alpine

# PostgreSQL Configuration
ENV DB_TYPE=postgresdb \
    DB_POSTGRESDB_DATABASE=synthstream-db \
    DB_POSTGRESDB_HOST=34.41.139.174 \
    DB_POSTGRESDB_PORT=5432 \
    DB_POSTGRESDB_USER=synthstream-db \
    DB_POSTGRESDB_PASSWORD=oPSsra6M[s9bpCLG

COPY --from=builder / /

WORKDIR /home/node
ENV NODE_ICU_DATA /usr/local/lib/node_modules/full-icu
EXPOSE 5678/tcp
