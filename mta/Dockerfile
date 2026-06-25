# Haraka MTA — the broker's own SMTP server (outbound relay, direct-to-MX).
# Runs as a sibling service on the on-prem host; the backoffice app submits to it.
FROM node:20-alpine

# tini for clean signal handling; Haraka installed globally.
RUN apk add --no-cache tini \
  && npm install -g Haraka@^3

WORKDIR /haraka
COPY config ./config

# Submission port the app connects to (mapped to localhost in compose).
EXPOSE 2525

# Persisted outbound queue lives here (mount a volume).
VOLUME ["/haraka/queue"]

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["haraka", "-c", "/haraka"]
