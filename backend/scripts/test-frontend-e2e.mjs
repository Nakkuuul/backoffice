/**
 * End-to-end test of the integrated FRONTEND auth flow against the real backend
 * (through the Next dev /api proxy). Drives a browser through:
 *   login → change password → 2FA enrol (reads the QR secret, computes a TOTP)
 *   → recovery codes → dashboard (/auth/me).
 * Uses a throwaway user (deleted afterwards) so the real admin is untouched.
 *
 *   Requires: backend on :3000, frontend dev on :3001.
 *   node scripts/test-frontend-e2e.mjs
 */
/* global document, location */ // referenced inside page.evaluate() (browser context)
import { authenticator } from "otplib";
import { pool } from "../src/db/pool.js";
import { register } from "../src/modules/auth-service/auth.service.js";

const FE = "http://localhost:3001";
const ts = Date.now();
const email = `demo${ts}@example.com`;
const temp = "TempPass#9";
const neo = "FreshPass#9999";
const results = [];
const check = (n, ok, d = "") => {
  results.push(ok);
  console.log(`${ok ? "✅" : "❌"} ${n}${d ? ` — ${d}` : ""}`);
};

const clickByText = async (page, text) =>
  page.evaluate((t) => {
    const el = [...document.querySelectorAll("button")].find((b) => b.innerText.includes(t));
    if (el) el.click();
    return Boolean(el);
  }, text);

let browser;
try {
  // Throwaway user (must change password on first login).
  await register({ email, password: temp, fullName: "E2E Demo", role: "operations" });

  const { default: puppeteer } = await import("puppeteer");
  browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  // 1) Credentials
  await page.goto(`${FE}/login`, { waitUntil: "networkidle0", timeout: 60000 });
  await page.type("#field-email", email);
  await page.type("#field-password", temp);
  await page.click('button[type="submit"]');

  // 2) Change password
  await page.waitForSelector("#field-new-password", { timeout: 20000 });
  check("login → change_password screen", true);
  await page.type("#field-new-password", neo);
  await page.type("#field-confirm-password", neo);
  await page.click('button[type="submit"]');

  // 3) Enrol 2FA — wait for the real secret, compute a TOTP code.
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll("p")].some((p) => /^[A-Z2-7]{4} [A-Z2-7]{4}/.test(p.textContent.trim())),
    { timeout: 20000 },
  );
  const secret = await page.evaluate(() => {
    const p = [...document.querySelectorAll("p")].find((el) => /^[A-Z2-7]{4} [A-Z2-7]{4}/.test(el.textContent.trim()));
    return p.textContent.replace(/\s/g, "");
  });
  check("change_password → 2FA enrol (QR + secret)", Boolean(secret), `secret len ${secret.length}`);

  const code = authenticator.generate(secret);
  await page.focus('[aria-label="Digit 1"]');
  await page.keyboard.type(code, { delay: 40 });

  // 4) Recovery codes
  await page.waitForFunction(() => document.body.innerText.includes("recovery codes"), { timeout: 20000 });
  check("2FA enable → recovery codes shown", true);
  const continued = await clickByText(page, "enter the backoffice");
  check("recovery → continue", continued);

  // 5) Overview dashboard (shell + /auth/me via the BFF cookie)
  await page.waitForFunction(() => location.pathname === "/overview", { timeout: 20000 });
  await page.waitForFunction(() => document.body.innerText.includes("Welcome,"), { timeout: 20000 });
  // innerText reflects CSS text-transform (uppercase), so compare case-insensitively.
  const dash = (await page.evaluate(() => document.body.innerText)).toLowerCase();
  check("overview renders /auth/me", dash.includes(email.toLowerCase()) && dash.includes("operations"), "welcome + email + role");

  // httpOnly hardening: tokens must NOT be readable by JS, and the access cookie
  // must carry the httpOnly flag.
  const docCookie = await page.evaluate(() => document.cookie);
  check("tokens not exposed to JS (document.cookie)", !/bo_at|bo_rt|bo_ct/.test(docCookie), docCookie || "(empty)");
  const cookies = await page.cookies();
  const at = cookies.find((c) => c.name === "bo_at");
  check("access cookie is httpOnly", Boolean(at && at.httpOnly), at ? `httpOnly=${at.httpOnly}` : "missing");

  const out = "C:/Users/hp/AppData/Local/Temp/claude/D--Aand-backoffice/ca8271f1-b96d-48ad-b8b1-b8431f78893c/scratchpad";
  await page.screenshot({ path: out + "/e2e-dashboard.png" });

  const passed = results.filter(Boolean).length;
  console.log(`\n${passed}/${results.length} checks passed`);
  process.exitCode = passed === results.length ? 0 : 1;
} catch (err) {
  console.error("\n❌", err.message);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  await pool.query("DELETE FROM users WHERE email = $1", [email]); // cascade cleans sessions/2fa
  await pool.end();
}
