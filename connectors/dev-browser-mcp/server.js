import { createInterface } from "readline";
import puppeteer from "puppeteer-core";

function send(msg) { process.stdout.write(JSON.stringify(msg) + "\n"); }
function result(id, data) { send({ jsonrpc: "2.0", id, result: data }); }
function errorResult(id, msg) { send({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify({ error: msg }) }], isError: true } }); }
function textResult(id, data) { result(id, { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] }); }

let browser;
async function getBrowser() {
  if (!browser || !browser.isConnected()) {
    browser = await puppeteer.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || "/usr/bin/chromium",
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu", "--disable-software-rasterizer"],
    });
  }
  return browser;
}

const DEV_URL = process.env.DEV_FRONTEND_URL || "http://dev-frontend";

const TOOLS = [
  {
    name: "browser.screenshot",
    description: "Navigate to a URL and take a screenshot. Returns page title, URL, console errors, and a base64 JPEG screenshot.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "Full URL to navigate to. Defaults to dev frontend." },
        path: { type: "string", description: "Path to append to dev frontend URL." },
        viewport: { type: "object", properties: { width: { type: "number" }, height: { type: "number" } } },
        fullPage: { type: "boolean", description: "Capture full scrollable page (default: false)" },
      },
    },
  },
  {
    name: "browser.check",
    description: "Navigate to a URL and check if specific elements exist, contain expected text, or are visible. Returns pass/fail results.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string" },
        path: { type: "string" },
        checks: {
          type: "array",
          items: {
            type: "object",
            properties: {
              selector: { type: "string" },
              exists: { type: "boolean" },
              text: { type: "string" },
              visible: { type: "boolean" },
            },
            required: ["selector"],
          },
        },
      },
      required: ["checks"],
    },
  },
  {
    name: "browser.interact",
    description: "Navigate to a URL and perform browser actions (click, type, select, waitFor, wait, getText, getTexts, evaluate, screenshot).",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string" },
        path: { type: "string" },
        actions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              type: { type: "string", enum: ["click", "type", "select", "waitFor", "wait", "getText", "getTexts", "evaluate", "screenshot"] },
              selector: { type: "string" },
              text: { type: "string" },
              value: { type: "string" },
              script: { type: "string" },
              ms: { type: "number" },
              timeout: { type: "number" },
            },
            required: ["type"],
          },
        },
      },
      required: ["actions"],
    },
  },
  {
    name: "browser.pageinfo",
    description: "Navigate to a URL and return page info: title, URL, status code, console errors, visible text, interactive elements.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string" },
        path: { type: "string" },
      },
    },
  },
];

function resolveUrl(args) {
  if (args.url) return args.url;
  if (args.path) return DEV_URL + args.path;
  return DEV_URL;
}

async function handleScreenshot(args) {
  const url = resolveUrl(args);
  const viewport = { width: args.viewport?.width || 1280, height: args.viewport?.height || 800 };
  const b = await getBrowser();
  const page = await b.newPage();
  try {
    await page.setViewport(viewport);
    const consoleErrors = [];
    page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
    const screenshot = await page.screenshot({ encoding: "base64", fullPage: args.fullPage || false, type: "jpeg", quality: 60 });
    const title = await page.title();
    return { ok: true, title, url: page.url(), consoleErrors, screenshotBase64: screenshot };
  } finally { await page.close(); }
}

async function handleCheck(args) {
  const url = resolveUrl(args);
  const b = await getBrowser();
  const page = await b.newPage();
  try {
    await page.setViewport({ width: 1280, height: 800 });
    const consoleErrors = [];
    page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
    const response = await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
    const statusCode = response?.status() || 0;
    const title = await page.title();
    const results = [];
    for (const check of args.checks || []) {
      const el = await page.$(check.selector);
      const exists = !!el;
      let text = null, isVisible = false;
      if (el) {
        text = await page.evaluate((e) => e.textContent, el);
        text = text?.trim()?.substring(0, 500);
        if (check.visible !== undefined) {
          isVisible = await page.evaluate((e) => { const s = window.getComputedStyle(e); return s.display !== "none" && s.visibility !== "hidden" && s.opacity !== "0"; }, el);
        }
      }
      const ok = (check.exists === undefined || exists === check.exists) && (!check.text || (text || "").includes(check.text)) && (check.visible === undefined || isVisible === check.visible);
      results.push({ selector: check.selector, exists, text, passed: ok, ...(check.visible !== undefined ? { visible: isVisible } : {}) });
    }
    return { ok: true, statusCode, title, allPassed: results.every((r) => r.passed) && !consoleErrors.length, consoleErrors, results };
  } finally { await page.close(); }
}

async function handleInteract(args) {
  const url = resolveUrl(args);
  const b = await getBrowser();
  const page = await b.newPage();
  try {
    await page.setViewport({ width: 1280, height: 800 });
    const consoleErrors = [];
    page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
    const results = [];
    for (const action of args.actions || []) {
      try {
        switch (action.type) {
          case "click": await page.click(action.selector); results.push({ action: "click", selector: action.selector, ok: true }); break;
          case "type": await page.type(action.selector, action.text || ""); results.push({ action: "type", selector: action.selector, ok: true }); break;
          case "select": await page.select(action.selector, action.value || ""); results.push({ action: "select", selector: action.selector, ok: true }); break;
          case "waitFor": await page.waitForSelector(action.selector, { timeout: action.timeout || 10000 }); results.push({ action: "waitFor", selector: action.selector, ok: true }); break;
          case "wait": await new Promise((r) => setTimeout(r, action.ms || 1000)); results.push({ action: "wait", ok: true }); break;
          case "getText": { const el = await page.$(action.selector); const t = el ? await page.evaluate((e) => e.textContent, el) : null; results.push({ action: "getText", selector: action.selector, text: t?.trim()?.substring(0, 500), ok: !!el }); break; }
          case "getTexts": { const els = await page.$$(action.selector); const ts = await Promise.all(els.map((e) => page.evaluate((el) => el.textContent?.trim(), e))); results.push({ action: "getTexts", selector: action.selector, texts: ts.map((t) => t?.substring(0, 200)), count: els.length, ok: true }); break; }
          case "evaluate": { const r = await page.evaluate(action.script); results.push({ action: "evaluate", result: r, ok: true }); break; }
          case "screenshot": { const ss = await page.screenshot({ encoding: "base64", type: "jpeg", quality: 60 }); results.push({ action: "screenshot", screenshotBase64: ss, ok: true }); break; }
          default: results.push({ action: action.type, ok: false, error: "unknown action" });
        }
      } catch (e) { results.push({ action: action.type, selector: action.selector, ok: false, error: e.message }); }
    }
    return { ok: true, title: await page.title(), consoleErrors, results };
  } finally { await page.close(); }
}

async function handlePageInfo(args) {
  const url = resolveUrl(args);
  const b = await getBrowser();
  const page = await b.newPage();
  try {
    await page.setViewport({ width: 1280, height: 800 });
    const consoleErrors = [];
    page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
    const response = await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
    const title = await page.title();
    const bodyText = await page.evaluate(() => document.body?.innerText?.substring(0, 3000) || "");
    const elements = await page.evaluate(() => {
      const els = [];
      document.querySelectorAll("button, a, input, select, textarea, [role='button']").forEach((el) => {
        els.push({ tag: el.tagName.toLowerCase(), text: el.textContent?.trim()?.substring(0, 100), type: el.getAttribute("type") || "", href: el.getAttribute("href") || "", id: el.id || "", placeholder: el.getAttribute("placeholder") || "" });
      });
      return els.slice(0, 50);
    });
    return { ok: true, statusCode: response?.status(), title, url: page.url(), consoleErrors, bodyText, interactiveElements: elements };
  } finally { await page.close(); }
}

async function handle(msg) {
  const { id, method, params } = msg;
  switch (method) {
    case "initialize": result(id, { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "dev-browser-mcp", version: "1.0.0" } }); break;
    case "notifications/initialized": break;
    case "tools/list": result(id, { tools: TOOLS }); break;
    case "tools/call": {
      const toolName = params?.name;
      const toolArgs = params?.arguments || {};
      try {
        switch (toolName) {
          case "browser.screenshot": textResult(id, await handleScreenshot(toolArgs)); break;
          case "browser.check": textResult(id, await handleCheck(toolArgs)); break;
          case "browser.interact": textResult(id, await handleInteract(toolArgs)); break;
          case "browser.pageinfo": textResult(id, await handlePageInfo(toolArgs)); break;
          default: errorResult(id, `Unknown tool: ${toolName}`);
        }
      } catch (err) { errorResult(id, err.message); }
      break;
    }
    case "ping": result(id, {}); break;
    default: if (id) send({ jsonrpc: "2.0", id, error: { code: -32601, message: `Unknown method: ${method}` } });
  }
}

const rl = createInterface({ input: process.stdin });
rl.on("line", async (line) => {
  try { await handle(JSON.parse(line.trim())); }
  catch (err) { process.stderr.write(`[dev-browser-mcp] Parse error: ${err.message}\n`); }
});
process.stderr.write("dev-browser-mcp started. DEV_FRONTEND_URL=" + DEV_URL + "\n");
