import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getBrowser } from "./publisher.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MEMORY_PATH = path.join(__dirname, "..", "..", "data", "xhs_publish_agent_memory.json");

// ══════════════════════════════════════════════════════
// Publish Agent Memory System
// ══════════════════════════════════════════════════════

let _memory = null;

function loadMemory() {
  if (_memory) return _memory;
  try {
    if (fs.existsSync(MEMORY_PATH)) {
      _memory = JSON.parse(fs.readFileSync(MEMORY_PATH, "utf-8"));
    }
  } catch {}
  if (!_memory) {
    _memory = {
      totalAttempts: 0,
      totalSuccesses: 0,
      strategies: {},
      lastSuccess: null,
      failures: [],
      patterns: {},
      createdAt: new Date().toISOString(),
    };
  }
  return _memory;
}

function saveMemory() {
  const dir = path.dirname(MEMORY_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(MEMORY_PATH, JSON.stringify(_memory, null, 2), "utf-8");
}

function recordAttempt(strategy, result) {
  const mem = loadMemory();
  mem.totalAttempts++;

  if (!mem.strategies[strategy]) {
    mem.strategies[strategy] = { attempts: 0, successes: 0, lastUsed: null, avgDuration: 0 };
  }
  const s = mem.strategies[strategy];
  s.attempts++;
  s.lastUsed = new Date().toISOString();

  if (result.success) {
    mem.totalSuccesses++;
    s.successes++;
    mem.lastSuccess = {
      strategy,
      timestamp: new Date().toISOString(),
      details: result.details || "",
    };
  } else {
    mem.failures.push({
      strategy,
      reason: result.reason || "unknown",
      timestamp: new Date().toISOString(),
    });
    // Keep only last 50 failures
    if (mem.failures.length > 50) mem.failures = mem.failures.slice(-50);
  }

  saveMemory();
  return mem;
}

function getBestStrategy() {
  const mem = loadMemory();
  let best = null;
  let bestScore = -1;

  for (const [name, s] of Object.entries(mem.strategies)) {
    if (s.attempts === 0) continue;
    // Score: success rate weighted by recency and total attempts
    const successRate = s.successes / s.attempts;
    const score = successRate * (1 + Math.log(s.attempts + 1) * 0.5);
    if (score > bestScore) {
      bestScore = score;
      best = name;
    }
  }

  return { strategy: best, score: bestScore, memory: mem };
}

// ══════════════════════════════════════════════════════
// Publish Strategies
// ══════════════════════════════════════════════════════

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Strategy 1: Shadow DOM coordinate click (PROVEN WORKING)
// Gets the "发布" button's exact coordinates from inside the shadow DOM,
// then uses page.mouse.click() at those coordinates.
async function strategyShadowDOM(page) {
  const coords = await page.evaluate(() => {
    const btn = document.querySelector("xhs-publish-btn");
    if (!btn || !btn.shadowRoot) return null;

    const publishBtn = Array.from(btn.shadowRoot.querySelectorAll("button"))
      .find(el => el.textContent.trim() === "发布");

    if (!publishBtn) return null;

    const r = publishBtn.getBoundingClientRect();
    return {
      cx: r.x + r.width / 2,
      cy: r.y + r.height / 2,
      visible: r.width > 0 && r.height > 0,
      disabled: publishBtn.disabled,
    };
  });

  if (!coords) return { success: false, reason: "shadow-publish-btn-not-found" };
  if (!coords.visible) return { success: false, reason: "shadow-publish-btn-not-visible" };

  if (coords.disabled) {
    // Try to enable by triggering Vue validation
    await page.evaluate(() => {
      const input = document.querySelector('input[placeholder*="标题"]');
      if (input) { input.focus(); input.blur(); }
      document.body.click();
    });
    await sleep(1000);

    // Re-check
    const recheck = await page.evaluate(() => {
      const btn = document.querySelector("xhs-publish-btn");
      if (!btn || !btn.shadowRoot) return null;
      const pb = Array.from(btn.shadowRoot.querySelectorAll("button"))
        .find(el => el.textContent.trim() === "发布");
      if (!pb) return null;
      const r = pb.getBoundingClientRect();
      return { cx: r.x + r.width / 2, cy: r.y + r.height / 2, disabled: pb.disabled };
    });

    if (!recheck || recheck.disabled) {
      return { success: false, reason: "publish-btn-still-disabled" };
    }
    coords.cx = recheck.cx;
    coords.cy = recheck.cy;
  }

  await page.mouse.click(coords.cx, coords.cy);
  return { success: true, details: "shadow-dom-coord-click", clickPos: { x: coords.cx, y: coords.cy } };
}

// Strategy 2: Coordinate fallback at estimated position
async function strategyCoordinateClick(page, xRatio = 0.85) {
  const btnRect = await page.evaluate(() => {
    const btn = document.querySelector("xhs-publish-btn");
    if (!btn) return null;
    const r = btn.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });

  if (!btnRect || btnRect.w === 0) {
    return { success: false, reason: "button-not-visible" };
  }

  await page.mouse.click(btnRect.x + btnRect.w * xRatio, btnRect.y + btnRect.h / 2);
  return { success: true, details: `coordinate-${xRatio}` };
}
async function strategyVueAccess(page) {
  const result = await page.evaluate(() => {
    const btn = document.querySelector("xhs-publish-btn");
    if (!btn) return { success: false, reason: "no-button" };

    // Walk up to find Vue app instance
    let el = btn;
    for (let i = 0; i < 15 && el; i++) {
      const vueKeys = Object.keys(el).filter(k => k.startsWith("__vue"));
      for (const key of vueKeys) {
        try {
          const vueInstance = el[key];
          if (vueInstance) {
            // Try to find props or methods related to publishing
            const props = vueInstance.props || vueInstance.$props || {};
            const attrs = vueInstance.$attrs || {};
            return {
              success: false,
              reason: "vue-found-but-no-publish-call",
              details: `Vue instance at level ${i}`,
              vueKeys: Object.keys(vueInstance).slice(0, 15),
            };
          }
        } catch {}
      }
      el = el.parentElement;
    }
    return { success: false, reason: "no-vue-instance-found" };
  });

  return result;
}

// ══════════════════════════════════════════════════════
// Dialog Handler
// ══════════════════════════════════════════════════════

async function checkAndHandleDialog(page) {
  const dialog = await page.evaluate(() => {
    const dialogs = document.querySelectorAll(".el-overlay-dialog, .el-dialog, [class*=dialog], [class*=modal]");
    for (const dlg of dialogs) {
      const style = window.getComputedStyle(dlg);
      if (style.display === "none") continue;
      const rect = dlg.getBoundingClientRect();
      if (rect.width < 20) continue;

      const buttons = Array.from(dlg.querySelectorAll("button"))
        .filter(b => window.getComputedStyle(b).display !== "none")
        .map(b => ({
          text: (b.textContent || "").trim(),
          disabled: b.disabled,
          rect: b.getBoundingClientRect(),
        }));

      return {
        found: true,
        class: (dlg.className || "").toString().substring(0, 80),
        text: (dlg.textContent || "").trim().substring(0, 300),
        buttons,
      };
    }
    return { found: false };
  });

  if (!dialog.found) return { handled: false, reason: "no-dialog" };

  const confirmBtn = dialog.buttons.find(b =>
    b.text.includes("发布") || b.text.includes("确定") || b.text.includes("确认")
  ) || dialog.buttons[dialog.buttons.length - 1];

  if (confirmBtn) {
    await page.mouse.click(
      confirmBtn.rect.x + confirmBtn.rect.width / 2,
      confirmBtn.rect.y + confirmBtn.rect.height / 2
    );
    return { handled: true, buttonText: confirmBtn.text };
  }

  return { handled: false, reason: "no-confirm-button", dialog };
}

// ══════════════════════════════════════════════════════
// Main Agent Publish Function
// ══════════════════════════════════════════════════════

async function publishWithAgent({ title, body, tags, images, cookies }) {
  const mem = loadMemory();
  const strategies = [
    { name: "shadow-dom", fn: strategyShadowDOM, priority: 1 },
    { name: "coordinate-85", fn: (p) => strategyCoordinateClick(p, 0.85), priority: 2 },
    { name: "coordinate-75", fn: (p) => strategyCoordinateClick(p, 0.75), priority: 3 },
  ];

  const bestInfo = getBestStrategy();
  if (bestInfo.strategy) {
    strategies.sort((a, b) => {
      if (a.name === bestInfo.strategy) return -1;
      if (b.name === bestInfo.strategy) return 1;
      return a.priority - b.priority;
    });
  }

  let page;

  try {
    // 复用 publisher.js 的共享浏览器，避免多实例冲突
    const browser = await getBrowser();
    page = await browser.newPage();

    // Force Shadow DOM to open BEFORE page load
    await page.evaluateOnNewDocument(() => {
      const origAttachShadow = Element.prototype.attachShadow;
      Element.prototype.attachShadow = function (init) {
        return origAttachShadow.call(this, { ...init, mode: "open" });
      };
    });

    // Set cookies
    if (cookies && Object.keys(cookies).length > 0) {
      const cookieEntries = Object.entries(cookies).map(([name, value]) => ({
        name, value: String(value), domain: ".xiaohongshu.com", path: "/",
      }));
      await page.setCookie(...cookieEntries);
    }

    // Navigate
    await page.goto("https://creator.xiaohongshu.com/publish/publish", {
      waitUntil: "networkidle2", timeout: 30000,
    });
    await sleep(3000);

    if (page.url().includes("login")) {
      return { success: false, status: "failed", reason: "Cookie已过期，需要重新登录" };
    }

    // Click 上传图文
    await page.evaluate(() => {
      Array.from(document.querySelectorAll("span.title"))
        .find(s => s.textContent.trim() === "上传图文" && s.offsetParent !== null)?.click();
    });
    await sleep(3000);

    // Upload images
    const debugDir = path.join(__dirname, "..", "..", "data");
    const localPaths = [];
    if (images && images.length > 0) {
      for (const img of images) {
        let localPath = img;
        if (img.startsWith("/uploads/")) {
          localPath = path.join(__dirname, "..", "..", "public", img);
        } else if (img.startsWith("http")) {
          try {
            const res = await fetch(img);
            const buf = Buffer.from(await res.arrayBuffer());
            const dlPath = path.join(debugDir, "xhs_upload_" + Date.now() + ".jpg");
            fs.writeFileSync(dlPath, buf);
            localPath = dlPath;
          } catch { continue; }
        }
        if (fs.existsSync(localPath)) localPaths.push(localPath);
      }
    }

    if (localPaths.length === 0) {
      const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
      const pp = path.join(debugDir, "xhs_placeholder.png");
      fs.writeFileSync(pp, png);
      localPaths.push(pp);
    }

    const fileInput = await page.$('input[type="file"]');
    if (fileInput) { await fileInput.uploadFile(...localPaths); await sleep(5000); }

    for (const lp of localPaths) {
      if (lp.includes("xhs_placeholder") || lp.includes("xhs_upload_")) {
        try { fs.unlinkSync(lp); } catch {}
      }
    }

    // Fill title
    await page.evaluate((t) => {
      const input = document.querySelector('input[placeholder*="标题"]');
      if (!input) return;
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
      setter.call(input, t);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }, title);
    await sleep(500);

    // Fill body
    await page.evaluate((b) => {
      const pm = document.querySelector(".ProseMirror");
      if (pm?.editor) pm.editor.chain().setContent(`<p>${b}</p>`).run();
    }, body);
    await sleep(1000);

    // Try each strategy to click publish
    let published = false;
    let usedStrategy = null;

    for (const strategy of strategies) {
      console.log(`  Agent trying strategy: ${strategy.name}...`);
      const result = await strategy.fn(page);
      await sleep(2000);

      if (result.success) {
        console.log(`  Strategy ${strategy.name}: click dispatched (${result.details})`);
        usedStrategy = strategy.name;

        const currentUrl = page.url();
        if (currentUrl.includes("publish/success") || currentUrl.includes("content")) {
          published = true;
          recordAttempt(strategy.name, { success: true, details: result.details + " -> success page" });
          break;
        }

        const dialogResult = await checkAndHandleDialog(page);
        if (dialogResult.handled) {
          console.log(`  Dialog handled: ${dialogResult.buttonText}`);
          await sleep(3000);
          const afterUrl = page.url();
          if (afterUrl.includes("publish/success") || afterUrl.includes("content")) {
            published = true;
            recordAttempt(strategy.name, { success: true, details: result.details + " + dialog -> success" });
            break;
          }
        }

        await sleep(1000);
        const postUrl = page.url();
        if (postUrl.includes("publish/success")) {
          published = true;
          recordAttempt(strategy.name, { success: true, details: result.details + " -> delayed success" });
          break;
        }

        recordAttempt(strategy.name, { success: false, reason: "clicked-but-unknown-result" });
      } else {
        console.log(`  Strategy ${strategy.name}: FAILED (${result.reason})`);
        recordAttempt(strategy.name, { success: false, reason: result.reason });
      }
    }

    const finalUrl = page.url();
    if (!published && finalUrl.includes("publish/success")) {
      published = true;
    }

    return {
      success: published,
      status: published ? "published" : (usedStrategy ? "submitted" : "draft"),
      strategy: usedStrategy,
      totalAttempts: mem.totalAttempts,
      totalSuccesses: mem.totalSuccesses,
      reason: published ? "发布成功！"
        : usedStrategy ? `已尝试策略 ${usedStrategy}，请在浏览器窗口中确认发布状态`
        : "所有策略均失败，请手动点击发布",
    };

  } catch (e) {
    console.error("Agent publish error:", e.message);
    return { success: false, status: "failed", reason: `发布异常: ${e.message}` };
  } finally {
    if (page) await page.close().catch(() => {});
  }
}

// ══════════════════════════════════════════════════════
// Memory Management API
// ══════════════════════════════════════════════════════

function getAgentMemory() {
  return loadMemory();
}

function resetAgentMemory() {
  _memory = {
    totalAttempts: 0,
    totalSuccesses: 0,
    strategies: {},
    lastSuccess: null,
    failures: [],
    patterns: {},
    createdAt: new Date().toISOString(),
  };
  saveMemory();
  return _memory;
}

function getStrategyStats() {
  const mem = loadMemory();
  const stats = [];
  for (const [name, s] of Object.entries(mem.strategies)) {
    stats.push({
      strategy: name,
      attempts: s.attempts,
      successes: s.successes,
      successRate: s.attempts > 0 ? (s.successes / s.attempts * 100).toFixed(1) + "%" : "N/A",
      lastUsed: s.lastUsed,
    });
  }
  stats.sort((a, b) => b.attempts - a.attempts);
  return stats;
}

export {
  publishWithAgent,
  getAgentMemory,
  resetAgentMemory,
  getStrategyStats,
  getBestStrategy,
};
