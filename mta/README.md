# MTA — the broker's own SMTP server (Haraka)

This is your **own outbound SMTP server**, running on the on-prem broker server
as a sibling container. The backoffice `email-service` submits mail to it on
port **2525**; Haraka then delivers **direct-to-MX** (straight to Gmail,
Outlook, Yahoo, etc.). No cloud, no third-party relay.

```
email-service (outbox + workers, DKIM) ──SMTP 2525──▶ Haraka (this) ──direct-to-MX:25──▶ recipients
```

## ⚠️ On-prem reality check (read this first)

You asked for 100M emails in 6 hours, no spam, from your own SMTP server on the
broker's on-prem connection. Be aware of the hard physical limits — these are
**infrastructure**, not software:

1. **Outbound port 25 must be open.** Most ISPs block outbound TCP/25 on
   business/broadband lines to stop spam. If your broker's connection blocks 25,
   direct-to-MX is impossible and no config fixes it. Confirm with the ISP and
   get it opened, or this whole approach is a non-starter.
2. **Static IP(s) + rDNS/PTR.** Every sending IP needs a static assignment and a
   reverse-DNS (PTR) record matching the HELO hostname (`config/me`,
   e.g. `mail.yourdomain.com`). Only the ISP can set PTR. Without it, major
   inboxes reject or spam-folder you.
3. **IP reputation & volume ceiling.** A single on-prem IP (or a handful)
   sustains only **~5–20 messages/sec to mixed ISPs** before throttling/blocks,
   and a brand-new IP must be **warmed over weeks**. **100M in 6 hours
   (~4,630/sec) from a few on-prem IPs to the inbox is not achievable** — that
   rate needs hundreds of warmed IPs, which an on-prem line won't have.
   - *Realistic on-prem*: low-hundreds-of-thousands to low-millions per day,
     ramped over time, with excellent auth + list hygiene.
   - *If 100M/6h is a hard requirement*, the only practical path is many static
     IPs from the ISP **or** relaying through a high-volume service — which
     conflicts with "our own server." This is a business/infra decision.
4. **Blocklists.** Self-hosted senders must monitor Spamhaus/Barracuda/etc. and
   maintain feedback loops; one bad run can blocklist your IP for weeks.

The software here is built correctly and will use every IP/throughput you give
it — but it cannot manufacture IP reputation. Set expectations accordingly.

## What's configured

| File | Purpose |
| --- | --- |
| `config/me` | HELO hostname — **must** have matching PTR/rDNS |
| `config/smtp.ini` | Submission listener (`:2525`), workers = CPUs |
| `config/plugins` | access, tls, auth_flat_file, relay (outbound is core) |
| `config/auth_flat_file.ini` | App's relay credentials — **change the password** |
| `config/relay_acl_allow` | Trusted CIDRs that may relay without AUTH (localhost) |
| `config/host_list` | Empty = outbound-only (we don't receive inbound mail) |
| `config/outbound.ini` | Concurrency / retry tuning (validate on deploy) |
| `config/tls.ini` | STARTTLS cert/key (provide on deploy) |
| `Dockerfile` | `node:20-alpine` + Haraka, runs `haraka -c /haraka` |

Relaying is locked down: only **authenticated** sessions (or hosts in
`relay_acl_allow`) can send. It is **not** an open relay.

## DKIM / SPF / DMARC (do all three — biggest anti-spam lever)

DKIM is signed **in the app** by default (`email-service`, tested). Generate the
key and publish DNS:

```bash
npm run email:gen-dkim s1 yourdomain.com   # writes secrets/dkim-s1.pem, prints DNS
```

Publish on your domain's DNS:
- **DKIM**: `s1._domainkey.yourdomain.com TXT "v=DKIM1; k=rsa; p=<public key>"`
- **SPF**: `yourdomain.com TXT "v=spf1 ip4:<your-mail-IP> -all"` (list your sending IP(s))
- **DMARC**: `_dmarc.yourdomain.com TXT "v=DMARC1; p=quarantine; rua=mailto:dmarc@yourdomain.com; adkim=s; aspf=s"`
- **PTR/rDNS**: ask the ISP to point each sending IP → `mail.yourdomain.com`.

(To sign at the MTA instead, enable `dkim_sign` in `config/plugins`, drop the key
under `config/dkim/...`, and set `DKIM_ENABLED=false` in the app — sign in ONE place.)

## Run it (on-prem)

```bash
# 1. Edit config/me (your mail hostname) and config/auth_flat_file.ini (password).
# 2. Build + start the MTA alongside Postgres:
docker compose up -d mta
# 3. Point the app at it (.env):
#    SMTP_HOST=127.0.0.1
#    SMTP_PORT=2525
#    SMTP_USER=relay@yourdomain.com
#    SMTP_PASS=<the password you set>
#    SMTP_SECURE=false
# 4. Watch delivery:
docker logs -f backoffice-mta
```

## Verify

```bash
# Submission reachable from the app host:
nc -zv 127.0.0.1 2525
# Outbound 25 egress allowed by the ISP (critical):
nc -zv gmail-smtp-in.l.google.com 25
# End-to-end: enqueue via the app, then check the queue / logs:
docker logs backoffice-mta | grep -i delivered
```

> Note: this MTA was scaffolded but cannot be exercised end-to-end in a dev
> sandbox (no port-25 egress, no public DNS/PTR). Validate config and delivery
> on the actual on-prem server. Tune `outbound.ini` keys against the installed
> Haraka version's docs.
