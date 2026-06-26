/**
 * E2E: drive the "forgot access" + reset frontend through the public BFF to the
 * backend — link flow, OTP flow, and the invalid-link state — asserting the
 * password actually changes in the DB. node scripts/test-reset-frontend-e2e.mjs
 */
/* global document */ // referenced inside page.evaluate() (browser context)
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { pool } from "../src/db/pool.js";
import * as auth from "../src/modules/auth-service/auth.service.js";
import * as users from "../src/modules/user-service/user.repository.js";

const FE = "http://localhost:3001";
const ts = Date.now();
const email = `fe-reset${ts}@example.com`;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const clickText = (page, text) =>
  page.evaluate((t) => {
    const el = [...document.querySelectorAll("button, a")].find((e) => e.textContent.trim().toLowerCase().includes(t.toLowerCase()));
    if (el) el.click();
    return Boolean(el);
  }, text);

const bodyHas = (page, text) =>
  page.waitForFunction((t) => document.body.innerText.toLowerCase().includes(t.toLowerCase()), { timeout: 20000 }, text);

async function pollOutbox(re) {
  for (let i = 0; i < 20; i++) {
    const { rows } = await pool.query(`SELECT body_text FROM email_messages ORDER BY id DESC LIMIT 1`);
    const m = rows[0]?.body_text?.match(re);
    if (m) return m[1];
    await wait(300);
  }
  return null;
}

let browser;
try {
  const u = await auth.register({ email, password: "OldPass#123", fullName: "FE Reset", role: "operations" });
  const userId = u.id;

  const { default: puppeteer } = await import("puppeteer");
  browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1512, height: 950 });

  // ── 1. Forgot (email link) ──────────────────────────────────────────────────
  await page.goto(`${FE}/forgot-password`, { waitUntil: "networkidle0", timeout: 60000 });
  await page.type("#field-email", email);
  assert.ok(await clickText(page, "Send reset instructions"), "send button");
  await bodyHas(page, "instructions sent");
  const token = await pollOutbox(/token=([A-Za-z0-9\-_]+)/);
  assert.ok(token, "reset link delivered to outbox");
  console.log("forgot(email_link) → sent confirmation + link delivered");

  // ── 2. Reset via link ───────────────────────────────────────────────────────
  await page.goto(`${FE}/reset-password?token=${token}`, { waitUntil: "networkidle0", timeout: 60000 });
  await page.waitForSelector("#field-new-password", { timeout: 20000 }); // link verified valid → form shown
  await page.type("#field-new-password", "BrandNew#456");
  await page.type("#field-confirm-password", "BrandNew#456");
  assert.ok(await clickText(page, "Reset password"), "reset button");
  await bodyHas(page, "password reset");
  let full = await users.findFullById(userId);
  assert.ok(await bcrypt.compare("BrandNew#456", full.password_hash), "password changed via link");
  console.log("reset(link) → success + DB password updated");

  // ── 3. Forgot (email OTP) + reset via OTP ────────────────────────────────────
  await page.goto(`${FE}/forgot-password`, { waitUntil: "networkidle0", timeout: 60000 });
  assert.ok(await clickText(page, "Email code"), "select email code method");
  await page.type("#field-email", email);
  await clickText(page, "Send reset instructions");
  await bodyHas(page, "instructions sent");
  const otp = await pollOutbox(/code is (\d{6})/);
  assert.ok(otp, "otp delivered to outbox");

  await page.goto(`${FE}/reset-password`, { waitUntil: "networkidle0", timeout: 60000 });
  await page.waitForSelector("#field-email", { timeout: 20000 });
  await page.type("#field-email", email);
  await page.focus('[aria-label="Digit 1"]');
  await page.keyboard.type(otp, { delay: 30 });
  await page.type("#field-new-password", "OtpReset#789");
  await page.type("#field-confirm-password", "OtpReset#789");
  await clickText(page, "Reset password");
  await bodyHas(page, "password reset");
  full = await users.findFullById(userId);
  assert.ok(await bcrypt.compare("OtpReset#789", full.password_hash), "password changed via OTP");
  console.log("reset(otp) → success + DB password updated");

  // ── 4. Invalid link state ─────────────────────────────────────────────────────
  await page.goto(`${FE}/reset-password?token=bogusbogusbogusbogus`, { waitUntil: "networkidle0", timeout: 60000 });
  await bodyHas(page, "expired");
  console.log("invalid link → expired state shown");

  console.log("\n✅ RESET FRONTEND E2E OK (link + otp through BFF, DB updated, invalid-link handled)");
} catch (err) {
  console.error("\n❌", err.stack || err.message);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  await pool.query("DELETE FROM users WHERE email = $1", [email]);
  await pool.end();
}
