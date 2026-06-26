/**
 * Drive the full login flow as a throwaway ADMIN (broad nav) and screenshot the
 * dashboard shell: overview, a section page, command palette, collapsed rail,
 * mobile drawer. Deletes the user afterwards. node scripts/shoot-dashboard.mjs
 */
/* global document, location */ // referenced inside page.evaluate() (browser context)
import { authenticator } from "otplib";
import { pool } from "../src/db/pool.js";
import { register } from "../src/modules/auth-service/auth.service.js";

const FE = "http://localhost:3001";
const OUT = "C:/Users/hp/AppData/Local/Temp/claude/D--Aand-backoffice/ca8271f1-b96d-48ad-b8b1-b8431f78893c/scratchpad";
const ts = Date.now();
const email = `boss${ts}@example.com`;
const temp = "TempPass#9";
const neo = "FreshPass#9999";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const clickText = (page, text) =>
  page.evaluate((t) => {
    const el = [...document.querySelectorAll("button, a")].find((e) => e.innerText.trim().includes(t));
    if (el) el.click();
    return Boolean(el);
  }, text);

let browser;
try {
  await register({ email, password: temp, fullName: "Priya Admin", role: "admin" });

  const { default: puppeteer } = await import("puppeteer");
  browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1512, height: 950, deviceScaleFactor: 2 });

  // Login → change password → enrol 2FA → overview
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
  await wait(1200);
  await page.screenshot({ path: `${OUT}/dash-overview.png` });
  console.log("shot dash-overview");

  // Company Info page (Masters → Company Info)
  await page.goto(`${FE}/masters/company-info`, { waitUntil: "networkidle0", timeout: 60000 });
  await wait(1100);
  await page.screenshot({ path: `${OUT}/dash-company.png`, fullPage: true });
  console.log("shot dash-company");

  // Masters section expanded (the long nested list)
  await clickText(page, "Masters");
  await wait(450);
  await page.screenshot({ path: `${OUT}/dash-masters.png` });
  console.log("shot dash-masters");

  // Section page (Masters → Securities)
  await clickText(page, "Securities");
  await page.waitForFunction(() => location.pathname.includes("securities"), { timeout: 20000 }).catch(() => {});
  await wait(900);
  await page.screenshot({ path: `${OUT}/dash-section.png` });
  console.log("shot dash-section");

  // Command palette
  await clickText(page, "Search the registry");
  await wait(400);
  await page.keyboard.type("ledger", { delay: 40 });
  await wait(500);
  await page.screenshot({ path: `${OUT}/dash-palette.png` });
  console.log("shot dash-palette");
  await page.keyboard.press("Escape");
  await wait(300);

  // Collapsed rail
  await page.click('[aria-label="Collapse sidebar"]').catch(() => {});
  await wait(500);
  await page.screenshot({ path: `${OUT}/dash-collapsed.png` });
  console.log("shot dash-collapsed");

  // Mobile drawer
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await page.goto(`${FE}/overview`, { waitUntil: "networkidle0", timeout: 60000 });
  await wait(900);
  await page.click('[aria-label="Open navigation"]').catch(() => {});
  await wait(500);
  await page.screenshot({ path: `${OUT}/dash-mobile.png` });
  console.log("shot dash-mobile");

  console.log("done");
} catch (err) {
  console.error("ERR", err.message);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  await pool.query("DELETE FROM users WHERE email = $1", [email]);
  await pool.end();
}
