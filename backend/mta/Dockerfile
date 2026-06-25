# Haraka MTA — the broker's own SMTP server. One image, two outbound delivery
# modes selectable at runtime via MTA_DELIVERY_MODE (direct | relay).
FROM node:20-alpine

RUN apk add --no-cache tini \
  && npm install -g Haraka@^3

WORKDIR /haraka
COPY config ./config
COPY plugins ./plugins
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# 25 = inbound MX (from internet), 2525 = submission (from the app).
EXPOSE 25 2525

# Persisted outbound queue.
VOLUME ["/haraka/queue"]

# entrypoint renders config from env, picks the mode, then execs Haraka.
ENTRYPOINT ["/sbin/tini", "--", "/entrypoint.sh"]
