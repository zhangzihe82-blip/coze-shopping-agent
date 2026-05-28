import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getBrowser } from "./publisher.js";
import { getAccount } from "./account.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_PATH = path.join(__dirname, "..", "..", "data", "xhs_optimizer_log.json");
const AGENT_MEMORY_PATH = path.join(__dirname, "..", "..", "data", "xhs_publish_agent_memory.json");
const CHECK_INTERVAL_MS = parseInt(process.env.XHS_OPTIMIZER_INTERVAL) || 21600000; // 默认6小时

// ══════════════════════════════════════════════════════
// State
// ══════════════════════════════════════════════════════

let _state = null;
let _timer = null;

function defaultState() {
  return {
    started: false,
    lastCheck: null,
    status: "idle",
    totalChecks: 0,
    failedChecks: 0,
    checks: [],
    warnings: [],
  };
}

function loadLog() {
  if (_state) return _state;
  try {
    if (fs.existsSync(LOG_PATH)) {
      const raw = JSON.parse(fs.readFileSync(LOG_PATH, "utf-8"));
      _state = { ...defaultState(), ...raw, started: false, status: "idle" };
    }
  } catch {}
  if (!_state) _state = defaultState();
  return _state;
}

function saveLog() {
  const dir = path.dirname(LOG_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const { started, ...persistable } = _state; // 不持久化 transient 字段
  fs.writeFileSync(LOG_PATH, JSON.stringify(persistable, null, 2), "utf-8");
}

// ══════════════════════════════════════════════════════
// Warning System
// ══════════════════════════════════════════════════════

function addWarning(type, message, details) {
  const s = loadLog();
  // 去重：同类警告不重复添加
  const dup = s.warnings.find(w => w.type === type && w.message === message);
  if (dup) return;
  s.warnings.unshift({ timestamp: new Date().toISOString(), type, message, details: details || "" });
  if (s.warnings.length > 100) s.warnings = s.warnings.slice(0, 100);
  saveLog();
}

// ══════════════════════════════════════════════════════
// DOM Snapshot (仅在失败时采集)
// ══════════════════════════════════════════════════════

async function captureDOMSnapshot(page) {
  try {
    return await page.evaluate(() => {
      const snapshot = { url: location.href, title: document.title, elements: {} };

      const checks = [
        ["tab-tuwen", "span.title", null],
        ["file-input", 'input[type="file"]', null],
        ["title-input", 'input[placeholder*="标题"]', null],
        ["publish-btn-host", "xhs-publish-btn", null],
      ];

      for (const [key, sel] of checks) {
        const el = document.querySelector(sel);
        if (!el) {
          snapshot.elements[key] = { exists: false };
          continue;
        }
        const tag = el.tagName?.toLowerCase() || "?";
        const r = el.getBoundingClientRect();
        const css = window.getComputedStyle(el);
        snapshot.elements[key] = {
          exists: true,
          visible: r.width > 0 && r.height > 0 && css.display !== "none",
          rect: { w: Math.round(r.width), h: Math.round(r.height) },
          className: (el.className || "").toString().substring(0, 100),
        };

        // 对 publish-btn 检查 Shadow DOM
        if (key === "publish-btn-host" && el.shadowRoot) {
          const btns = Array.from(el.shadowRoot.querySelectorAll("button"));
          snapshot.elements[key].shadowButtons = btns.map(b => ({
            text: (b.textContent || "").trim(),
            disabled: b.disabled,
            visible: b.getBoundingClientRect().width > 0,
          }));
          snapshot.elements[key].hasShadowRoot = true;
        } else if (key === "publish-btn-host") {
          snapshot.elements[key].hasShadowRoot = false;
        }
      }

      // 页面前 20 个可见按钮
      const allBtns = Array.from(document.querySelectorAll("button"))
        .filter(b => window.getComputedStyle(b).display !== "none")
        .slice(0, 20)
        .map(b => ({
          text: (b.textContent || "").trim().substring(0, 40),
          disabled: b.disabled,
        }));
      snapshot.visibleButtons = allBtns;

      return snapshot;
    });
  } catch {
    return { error: "DOM snapshot failed" };
  }
}

// ══════════════════════════════════════════════════════
// Failure Pattern Analysis
// ══════════════════════════════════════════════════════

function analyzeFailurePatterns() {
  try {
    if (!fs.existsSync(AGENT_MEMORY_PATH)) return;
    const mem = JSON.parse(fs.readFileSync(AGENT_MEMORY_PATH, "utf-8"));

    if (!mem.failures || mem.failures.length === 0) return;

    // 检查连续失败
    const recent = mem.failures.slice(-10);
    const byStrategy = {};
    for (const f of recent) {
      if (!byStrategy[f.strategy]) byStrategy[f.strategy] = [];
      byStrategy[f.strategy].push(f);
    }
    for (const [name, fails] of Object.entries(byStrategy)) {
      if (fails.length >= 3) {
        addWarning(
          "consecutive-failure",
          `策略 "${name}" 最近连续失败 ${fails.length} 次`,
          `最近原因: ${fails.map(f => f.reason).join(", ")}`
        );
      }
    }

    // 检查整体成功率
    if (mem.totalAttempts > 10) {
      const rate = mem.totalSuccesses / mem.totalAttempts;
      if (rate < 0.5) {
        addWarning(
          "low-success-rate",
          `整体发布成功率仅 ${(rate * 100).toFixed(1)}%（${mem.totalSuccesses}/${mem.totalAttempts}）`,
          "建议检查页面结构是否变化或 Cookie 是否有效"
        );
      }
    }
  } catch {}
}

// ══════════════════════════════════════════════════════
// Health Check
// ══════════════════════════════════════════════════════

async function runHealthCheck() {
  const s = loadLog();
  s.status = "checking";
  const steps = [];
  let checkStatus = "healthy";
  let error = null;
  let domSnapshot = null;
  const startTime = Date.now();
  let page = null;

  try {
    // Step 1: 检查账号
    const account = getAccount();
    if (!account || !account.cookies || Object.keys(account.cookies).length === 0) {
      steps.push({ step: "account", ok: true, note: "skipped-no-account" });
      s.status = "healthy";
      s.lastCheck = new Date().toISOString();
      s.totalChecks++;
      s.checks.unshift({ timestamp: s.lastCheck, status: "skipped", steps, duration: Date.now() - startTime, error: null });
      if (s.checks.length > 200) s.checks = s.checks.slice(0, 200);
      saveLog();
      return { status: "skipped", steps, duration: Date.now() - startTime, reason: "未关联小红书账号" };
    }
    steps.push({ step: "account", ok: true });

    // Step 2: 获取浏览器
    const browser = await getBrowser();
    page = await browser.newPage();

    // Step 3: 注入 Shadow DOM patch
    await page.evaluateOnNewDocument(() => {
      const orig = Element.prototype.attachShadow;
      Element.prototype.attachShadow = function (init) {
        return orig.call(this, { ...init, mode: "open" });
      };
    });
    steps.push({ step: "shadow-dom-patch", ok: true });

    // Step 4: 设置 Cookie 并导航
    const cookieEntries = Object.entries(account.cookies).map(([name, value]) => ({
      name, value: String(value), domain: ".xiaohongshu.com", path: "/",
    }));
    await page.setCookie(...cookieEntries);
    steps.push({ step: "cookies-set", ok: true });

    await page.goto("https://creator.xiaohongshu.com/publish/publish", {
      waitUntil: "networkidle2", timeout: 30000,
    });
    await new Promise(r => setTimeout(r, 3000));
    steps.push({ step: "navigation", ok: true });

    // Step 5: 检查登录状态
    const currentUrl = page.url();
    if (currentUrl.includes("login")) {
      steps.push({ step: "login-check", ok: false, error: "Cookie已过期" });
      addWarning("cookie-expired", "Cookie已过期，发布流程无法使用", "请重新登录小红书创作平台并更新Cookie");
      checkStatus = "error";
      domSnapshot = await captureDOMSnapshot(page);
    } else {
      steps.push({ step: "login-check", ok: true });
    }

    // Step 6-9: 检查关键元素（仅在未登录重定向时仍有意义）
    const elementChecks = [
      { step: "tab-tuwen", js: `(() => { const s = Array.from(document.querySelectorAll("span.title")).find(e => e.textContent.trim() === "上传图文"); return !!s && s.offsetParent !== null; })()` },
      { step: "file-input", js: `!!document.querySelector('input[type="file"]')` },
      { step: "title-input", js: `!!document.querySelector('input[placeholder*="标题"]')` },
      { step: "publish-button", js: `(() => { const b = document.querySelector("xhs-publish-btn"); if (!b || !b.shadowRoot) return false; const pb = Array.from(b.shadowRoot.querySelectorAll("button")).find(e => e.textContent.trim() === "发布"); return !!(pb && pb.getBoundingClientRect().width > 0); })()` },
    ];

    for (const { step, js } of elementChecks) {
      try {
        const ok = await page.evaluate(js);
        steps.push({ step, ok });
        if (!ok && checkStatus === "healthy") checkStatus = "warning";
        if (!ok && !domSnapshot) domSnapshot = await captureDOMSnapshot(page);
      } catch (e) {
        steps.push({ step, ok: false, error: e.message });
        checkStatus = "warning";
        if (!domSnapshot) domSnapshot = await captureDOMSnapshot(page);
      }
    }

  } catch (e) {
    checkStatus = "error";
    error = e.message;
    steps.push({ step: "fatal", ok: false, error: e.message });
  } finally {
    if (page) await page.close().catch(() => {});
  }

  const duration = Date.now() - startTime;
  s.lastCheck = new Date().toISOString();
  s.status = checkStatus;
  s.totalChecks++;
  if (checkStatus !== "healthy" && checkStatus !== "skipped") s.failedChecks++;

  s.checks.unshift({ timestamp: s.lastCheck, status: checkStatus, steps, duration, error, domSnapshot });
  if (s.checks.length > 200) s.checks = s.checks.slice(0, 200);

  // 分析失败趋势
  analyzeFailurePatterns();

  saveLog();
  return { status: checkStatus, steps, duration, error, domSnapshot };
}

// ══════════════════════════════════════════════════════
// Lifecycle
// ══════════════════════════════════════════════════════

function startOptimizer() {
  const s = loadLog();
  if (s.started) return;

  s.started = true;
  saveLog();

  // 首次检查延迟 10 秒，避免阻塞服务启动
  _timer = setTimeout(async () => {
    try {
      console.log("[Optimizer] 首次健康检查...");
      const result = await runHealthCheck();
      console.log(`[Optimizer] 首次检查完成: ${result.status}`);
    } catch (e) {
      console.error("[Optimizer] 首次检查失败:", e.message);
    }

    // 后续循环检查（首次之后开始）
    _timer = setInterval(async () => {
      try {
        console.log("[Optimizer] 定时健康检查...");
        const result = await runHealthCheck();
        console.log(`[Optimizer] 检查完成: ${result.status}`);
      } catch (e) {
        console.error("[Optimizer] 定时检查失败:", e.message);
      }
    }, CHECK_INTERVAL_MS);
  }, 10000);
}

function stopOptimizer() {
  if (_timer) { clearTimeout(_timer); clearInterval(_timer); _timer = null; }
  const s = loadLog();
  s.started = false;
  saveLog();
}

function getOptimizerStatus() {
  const s = loadLog();
  return {
    started: s.started,
    lastCheck: s.lastCheck,
    status: s.status,
    totalChecks: s.totalChecks,
    failedChecks: s.failedChecks,
    warnings: s.warnings.slice(0, 10),
    intervalMs: CHECK_INTERVAL_MS,
  };
}

function getRecentLogs(limit = 20) {
  const s = loadLog();
  return s.checks.slice(0, limit);
}

export {
  startOptimizer,
  stopOptimizer,
  runHealthCheck,
  getOptimizerStatus,
  getRecentLogs,
};
