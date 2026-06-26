/**
 * E2E: drive the Company Info edit form as an admin through the httpOnly BFF —
 * open Edit, change a profile field + a membership field, Save, and assert the
 * change persisted (view + DB). node scripts/test-company-edit-e2e.mjs
 */
/* global document */ // referenced inside page.evaluate() (browser context)
import assert from "node:assert/strict";
import { authenticator } from "otplib";
import { pool } from "../src/db/pool.js";
import { register } from "../src/modules/auth-service/auth.service.js";

const FE = "http://localhost:3001";
const ts = Date.now();
const email = `editor${ts}@example.com`;
const temp = "TempPass#9";
const neo = "FreshPass#9999";
const CIN = "U67120MH2019PTC999999";
const TMID = "90999";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const clickText = (page, text) =>
  page.evaluate((t) => {
    const el = [...document.querySelectorAll("button, a")].find((e) => e.innerText.trim().includes(t));
    if (el) el.click();
    return Boolean(el);
  }, text);

const setByLabel = (page, label, value) =>
  page.evaluate(
    ({ label, value }) => {
      const span = [...document.querySelectorAll("label span")].find((s) => s.textContent.trim() === label);
      const input = span?.parentElement?.querySelector("input");
      if (!input) return false;
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
      setter.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      return true;
    },
    { label, value },
  );

let browser;
try {
  await register({ email, password: temp, fullName: "Edit Admin", role: "admin" });
  const { default: puppeteer } = await import("puppeteer");
  browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1512, height: 950 });
  page.on("pageerror", (e) => console.log("PAGEERR", e.message));
  page.on("response", async (r) => {
    const u = r.request().url();
    if (u.includes("/bff/api/company")) {
      let t = "";
      try {
        t = await r.text();
      } catch {
        /* empty */
      }
      console.log("RESP", r.request().method(), u.split("/bff/api")[1], r.status(), t.slice(0, 240));
    }
  });

  // Login → change password → enrol 2FA → app
  await page.goto(`${FE}/login`, { waitUntil: "networkidle0", timeout: 60000 });
  await page.type("#field-email", email);
  await page.type("#field-password", temp);
  await page.click('button[type="submit"]');
  await page.waitForSelector("#field-new-password", { timeout: 20000 });
  await page.type("#field-new-password", neo);
  await page.type("#field-confirm-password", neo);
  await page.click('button[type="submit"]');
  await page.waitForFunction(
    () => [...document.querySelectorAll("p")].some((p) => /^[A-Z2-7]{4} [A-Z2-7]{4}/.test(p.textContent.trim())),
    { timeout: 20000 },
  );
  const secret = await page.evaluate(() => {
    const p = [...document.querySelectorAll("p")].find((el) => /^[A-Z2-7]{4} [A-Z2-7]{4}/.test(el.textContent.trim()));
    return p.textContent.replace(/\s/g, "");
  });
  await page.focus('[aria-label="Digit 1"]');
  await page.keyboard.type(authenticator.generate(secret), { delay: 40 });
  await page.waitForFunction(() => document.body.innerText.includes("recovery codes"), { timeout: 20000 });
  await clickText(page, "enter the backoffice");
  await page.waitForFunction(() => location.pathname === "/overview", { timeout: 20000 });

  // Company Info → Edit
  await page.goto(`${FE}/masters/company-info`, { waitUntil: "networkidle0", timeout: 60000 });
  await page.waitForFunction(() => document.body.innerText.includes("Edit profile"), { timeout: 20000 });
  assert.ok(await clickText(page, "Edit profile"), "Edit profile button");
  // Edit mode shows the "Save changes" button (text is CSS-uppercased elsewhere, so compare loosely).
  await page.waitForFunction(() => document.body.innerText.toLowerCase().includes("save changes"), { timeout: 20000 });
  console.log("edit mode opened");

  assert.ok(await setByLabel(page, "CIN", CIN), "set CIN");
  assert.ok(await setByLabel(page, "Trading Member ID", TMID), "set Trading Member ID (first membership)");
  await wait(200);

  assert.ok(await clickText(page, "Save changes"), "Save changes button");
  // Back to read-only view, with the new CIN visible
  await page.waitForFunction((cin) => document.body.innerText.includes(cin), { timeout: 20000 }, CIN);
  console.log("saved; view shows new CIN");

  const body = await page.evaluate(() => document.body.innerText);
  assert.ok(body.includes(CIN), "CIN visible in view");
  assert.ok(body.includes(TMID), "trading member id visible in view");

  // Persisted in DB?
  const { rows } = await pool.query("SELECT cin FROM company_profile WHERE id = 1");
  assert.equal(rows[0].cin, CIN, "CIN persisted to DB");
  const { rows: m } = await pool.query("SELECT count(*)::int AS n FROM company_memberships WHERE trading_member_id = $1", [TMID]);
  assert.ok(m[0].n >= 1, "trading member id persisted to DB");

  console.log("\n✅ COMPANY EDIT E2E OK (profile PUT + membership PATCH via BFF, persisted)");
} catch (err) {
  console.error("\n❌", err.stack || err.message);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  await pool.query("DELETE FROM users WHERE email = $1", [email]);
  await pool.end();
}
