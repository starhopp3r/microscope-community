FROM --platform=linux/amd64 node:22.23.3-bookworm-slim@sha256:c3de60bf2f9dd0ac6370e6117950ff62d6e339527e7472301c9c78a017978392

ARG CHROME_VERSION=155.0.8059.39
ARG CHROME_SHA256=55672d1f392fd3e7b7a08621b6e804e6bcb39d40cf155504abb74b3a021ea8ea
ARG ACORN_VERSION=8.19.0
ARG ACORN_INTEGRITY=sha512-oJlA3XiRm7Cyk6qFD2Jn8ak9B7jSy0qy00ADO3+8dpT0LSjFihQYv4C02LFCSYJV3Q37xYwwRy5m+IpIiUzqWw==

RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl unzip \
    libasound2 libatk-bridge2.0-0 libatk1.0-0 libatspi2.0-0 libcairo2 libcups2 libdbus-1-3 libdrm2 libexpat1 \
    libgbm1 libglib2.0-0 libnspr4 libnss3 libpango-1.0-0 libx11-6 libxcb1 libxcomposite1 libxdamage1 libxext6 \
    libxfixes3 libxkbcommon0 libxrandr2 libvulkan1 fonts-liberation fonts-dejavu-core webp \
 && curl -fsSL -o /tmp/chrome.zip "https://storage.googleapis.com/chrome-for-testing-public/${CHROME_VERSION}/linux64/chrome-linux64.zip" \
 && echo "${CHROME_SHA256}  /tmp/chrome.zip" | sha256sum -c - \
 && unzip -q /tmp/chrome.zip -d /opt \
 && rm /tmp/chrome.zip \
 && mkdir -p /opt/tools && cd /opt/tools \
 && npm pack --silent "acorn@${ACORN_VERSION}" \
 && echo "${ACORN_INTEGRITY}" > expected \
 && node -e 'const c=require("crypto"),f=require("fs");const h="sha512-"+c.createHash("sha512").update(f.readFileSync("acorn-'"${ACORN_VERSION}"'.tgz")).digest("base64");if(h!==f.readFileSync("expected","utf8").trim()){console.error("acorn integrity mismatch");process.exit(1)}' \
 && mkdir -p node_modules/acorn && tar -xzf "acorn-${ACORN_VERSION}.tgz" -C node_modules/acorn --strip-components=1 \
 && rm -f "acorn-${ACORN_VERSION}.tgz" expected \
 && apt-get purge -y curl unzip && apt-mark manual webp && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*

RUN printf '#!/bin/sh\nexec /opt/chrome-linux64/chrome --no-sandbox --disable-dev-shm-usage "$@"\n' > /opt/chrome && chmod 755 /opt/chrome
ENV CHROME_PATH=/opt/chrome
ENV NODE_PATH=/opt/tools/node_modules
ENV HOME=/tmp
USER node
WORKDIR /work
