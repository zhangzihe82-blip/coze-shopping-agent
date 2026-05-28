import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import puppeteer from "puppeteer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HISTORY_PATH = path.join(__dirname, "..", "..", "data", "xhs_publish_history.json");
const USER_DATA_DIR = path.join(__dirname, "..", "..", "data", "xhs_browser_profile");
const CHROME_PATH = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";

let _browser = null;

// ─── Browser lifecycle ───

function killBrowserProcess() {
  _browser = null;
  const lockFiles = ["SingletonLock", "SingletonCookie", "SingletonSocket"];
  for (const f of lockFiles) {
    try { fs.unlinkSync(path.join(USER_DATA_DIR, f)); } catch {}
  }
}

async function getBrowser() {
  if (_browser?.connected) return _browser;

  killBrowserProcess();

  const commonArgs = [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-blink-features=AutomationControlled",
    "--no-proxy-server",
    "--disable-extensions",
    "--disable-features=TranslateUI,BackForwardCache",
    "--window-size=1280,900",
  ];

  try {
    _browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: false,
      userDataDir: USER_DATA_DIR,
      args: commonArgs,
      ignoreDefaultArgs: ["--enable-automation"],
      defaultViewport: { width: 1280, height: 900 },
    });

    _browser.on("disconnected", () => {
      killBrowserProcess();
    });

    return _browser;
  } catch (e) {
    if (e.message.includes("already running")) {
      console.warn("Browser profile locked, using temp profile");
      const tempDir = USER_DATA_DIR + "_" + Date.now();
      _browser = await puppeteer.launch({
        executablePath: CHROME_PATH,
        headless: false,
        userDataDir: tempDir,
        args: commonArgs,
        ignoreDefaultArgs: ["--enable-automation"],
        defaultViewport: { width: 1280, height: 900 },
      });
      _browser.on("disconnected", () => { _browser = null; });
      return _browser;
    }
    throw e;
  }
}

async function closeBrowser() {
  if (_browser?.connected) {
    await _browser.close().catch(() => {});
    killBrowserProcess();
  }
}

// ─── History ───

function loadHistory() {
  try {
    if (fs.existsSync(HISTORY_PATH)) {
      return JSON.parse(fs.readFileSync(HISTORY_PATH, "utf-8"));
    }
  } catch {}
  return [];
}

function saveHistory(entry) {
  const history = loadHistory();
  history.unshift(entry);
  const dir = path.dirname(HISTORY_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(HISTORY_PATH, JSON.stringify(history.slice(0, 100), null, 2), "utf-8");
  return entry;
}

// ─── Primary: Puppeteer browser automation ───

async function publishViaBrowser({ title, body, tags, images, cookies }) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  const debugDir = path.join(__dirname, "..", "..", "data");
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  try {
    // ─── CRITICAL: Force all Shadow DOMs to "open" mode ───
    // This must run BEFORE navigation so it intercepts Vue's attachShadow calls
    await page.evaluateOnNewDocument(() => {
      const origAttachShadow = Element.prototype.attachShadow;
      Element.prototype.attachShadow = function (init) {
        return origAttachShadow.call(this, { ...init, mode: "open" });
      };
    });

    // Set auth cookies
    if (cookies && Object.keys(cookies).length > 0) {
      const cookieEntries = Object.entries(cookies).map(([name, value]) => ({
        name,
        value: String(value),
        domain: ".xiaohongshu.com",
        path: "/",
      }));
      await page.setCookie(...cookieEntries);
    }

    // Navigate to publish page
    await page.goto("https://creator.xiaohongshu.com/publish/publish", {
      waitUntil: "networkidle2",
      timeout: 30000,
    });
    await sleep(3000);

    // Check login state
    const pageUrl = page.url();
    if (pageUrl.includes("login") || pageUrl.includes("signin")) {
      return { success: false, reason: "Cookie已过期，需要重新登录" };
    }

    // Step 1: Click "上传图文" tab
    const tabClicked = await page.evaluate(() => {
      const tab = Array.from(document.querySelectorAll("span.title"))
        .find(s => s.textContent.trim() === "上传图文" && s.offsetParent !== null);
      if (tab) { tab.click(); return true; }
      return false;
    });
    if (!tabClicked) return { success: false, reason: "找不到上传图文选项卡" };
    await sleep(3000);

    // Step 2: Upload images
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
      const placeholderPng = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        "base64"
      );
      const placeholderPath = path.join(debugDir, "xhs_placeholder.png");
      fs.writeFileSync(placeholderPath, placeholderPng);
      localPaths.push(placeholderPath);
    }

    const fileInput = await page.$('input[type="file"]');
    if (fileInput) {
      await fileInput.uploadFile(...localPaths);
      await sleep(5000);
    }

    for (const lp of localPaths) {
      if (lp.includes("xhs_placeholder") || lp.includes("xhs_upload_")) {
        try { fs.unlinkSync(lp); } catch {}
      }
    }

    // Step 3: Fill title
    const titleFilled = await page.evaluate((titleText) => {
      const input = document.querySelector('input[placeholder*="标题"]');
      if (!input) return false;
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype, "value"
      ).set;
      setter.call(input, titleText);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }, title);
    await sleep(500);

    // Step 4: Fill body
    const bodyFilled = await page.evaluate((bodyText) => {
      const pm = document.querySelector(".ProseMirror");
      if (!pm?.editor) return false;
      pm.editor.chain().setContent(`<p>${bodyText}</p>`).run();
      return true;
    }, body);
    await sleep(1000);

    // Step 5: Add tags
    if (tags && tags.length > 0) {
      await page.evaluate((tagsArr) => {
        const topicBtn = Array.from(document.querySelectorAll("button"))
          .find(b => (b.textContent || "").trim() === "话题" && b.offsetParent !== null);
        if (topicBtn) topicBtn.click();

        setTimeout(() => {
          const topicInput = document.querySelector('input[placeholder*="话题"], input[placeholder*="搜索"]');
          if (topicInput) {
            for (const tag of tagsArr) {
              const tagName = tag.startsWith("#") ? tag.slice(1) : tag;
              const setter = Object.getOwnPropertyDescriptor(
                window.HTMLInputElement.prototype, "value"
              ).set;
              setter.call(topicInput, tagName);
              topicInput.dispatchEvent(new Event("input", { bubbles: true }));
              topicInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
            }
          }
        }, 500);
      }, tags);
      await sleep(2000);
    }

    await page.screenshot({ path: path.join(debugDir, "xhs_before_publish.png") }).catch(() => {});

    // ══════════════════════════════════════════════════
    // Step 6: Click the publish button via Shadow DOM
    // ══════════════════════════════════════════════════

    let publishClicked = false;
    let dialogHandled = false;

    // Get the "发布" button's screen coordinates from inside the Shadow DOM
    const btnCoords = await page.evaluate(() => {
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

    if (btnCoords && btnCoords.visible && !btnCoords.disabled) {
      console.log(`Clicking publish at (${btnCoords.cx}, ${btnCoords.cy})`);
      await page.mouse.click(btnCoords.cx, btnCoords.cy);
      publishClicked = true;
    } else if (btnCoords?.disabled) {
      console.log("Publish button is disabled - trying to trigger Vue update...");
      // Button might be disabled because Vue hasn't detected the input changes
      // Try blurring the title/body to trigger validation
      await page.evaluate(() => {
        const input = document.querySelector('input[placeholder*="标题"]');
        if (input) { input.focus(); input.blur(); }
        // Also click on body to trigger any pending validations
        document.body.click();
      });
      await sleep(1000);

      // Re-check if button is now enabled
      const recheck = await page.evaluate(() => {
        const btn = document.querySelector("xhs-publish-btn");
        if (!btn || !btn.shadowRoot) return null;
        const publishBtn = Array.from(btn.shadowRoot.querySelectorAll("button"))
          .find(el => el.textContent.trim() === "发布");
        if (!publishBtn) return null;
        const r = publishBtn.getBoundingClientRect();
        return {
          cx: r.x + r.width / 2,
          cy: r.y + r.height / 2,
          disabled: publishBtn.disabled,
        };
      });

      if (recheck && !recheck.disabled) {
        console.log("Button now enabled, clicking...");
        await page.mouse.click(recheck.cx, recheck.cy);
        publishClicked = true;
      }
    }

    // Fallback: try coordinate-based clicking at estimated positions
    if (!publishClicked) {
      console.log("Falling back to coordinate estimation...");
      const fallbackRect = await page.evaluate(() => {
        const btn = document.querySelector("xhs-publish-btn");
        if (!btn) return null;
        const r = btn.getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width, h: r.height };
      });

      if (fallbackRect && fallbackRect.w > 0) {
        for (const xRatio of [0.85, 0.75, 0.65]) {
          await page.mouse.click(
            fallbackRect.x + fallbackRect.w * xRatio,
            fallbackRect.y + fallbackRect.h / 2
          );
          await sleep(500);

          const hasDialog = await page.evaluate(() => {
            const dialogs = document.querySelectorAll(".el-overlay-dialog, .el-dialog, [class*=dialog]");
            for (const dlg of dialogs) {
              const style = window.getComputedStyle(dlg);
              if (style.display !== "none" && dlg.getBoundingClientRect().width > 20) return true;
            }
            return false;
          });

          if (hasDialog) { publishClicked = true; break; }
        }
      }
    }

    await sleep(3000);

    // Step 7: Handle confirmation dialog
    const dialogResult = await page.evaluate(() => {
      const dialogs = document.querySelectorAll(".el-overlay-dialog, .el-dialog, [class*=dialog]");
      for (const dlg of dialogs) {
        const style = window.getComputedStyle(dlg);
        if (style.display === "none") continue;
        const rect = dlg.getBoundingClientRect();
        if (rect.width === 0) continue;

        const confirmBtn = Array.from(dlg.querySelectorAll("button"))
          .find(b => {
            const text = (b.textContent || "").trim();
            return text.includes("发布") || text.includes("确定") || text.includes("确认");
          });
        if (confirmBtn) {
          confirmBtn.click();
          return { handled: true, buttonText: (confirmBtn.textContent || "").trim() };
        }
      }
      return { handled: false };
    });

    if (dialogResult.handled) {
      dialogHandled = true;
      console.log("Confirmation dialog handled:", dialogResult.buttonText);
    }

    await sleep(5000);

    const finalUrl = page.url();
    const success = publishClicked &&
      (finalUrl.includes("content") || finalUrl.includes("published") ||
       finalUrl.includes("success") || finalUrl.includes("note"));

    return {
      success: publishClicked,
      status: success ? "published" : (publishClicked ? "submitted" : "draft"),
      fillResult: [`title:${titleFilled ? "ok" : "fail"}`, `body:${bodyFilled ? "ok" : "fail"}`],
      shadowDOM: publishResult.error ? `shadow:${publishResult.error}` : "shadow:ok",
      reason: success ? "发布成功"
        : publishClicked ? (dialogHandled ? "已确认发布，请检查发布状态" : "已点击发布，请确认发布状态")
        : publishResult.error === "no-shadow-root"
          ? "Shadow DOM 仍为关闭状态，坐标点击未触发发布。请在打开的浏览器窗口中手动点击发布按钮"
          : "内容已填写完毕，请在打开的浏览器窗口中手动点击发布按钮",
    };
  } finally {
    await page.close().catch(() => {});
  }
}

// ─── Fallback: HTTP API approach ───

async function publishViaAPI({ title, body, tags, images, cookies }) {
  if (!cookies || Object.keys(cookies).length === 0) {
    return { success: false, reason: "需要Cookie认证" };
  }

  const cookieHeader = Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");

  const headers = {
    "Content-Type": "application/json;charset=UTF-8",
    "Cookie": cookieHeader,
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
    "Origin": "https://creator.xiaohongshu.com",
    "Referer": "https://creator.xiaohongshu.com/publish/publish",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "zh-CN,zh;q=0.9",
  };

  try {
    let imageIds = [];
    if (images && images.length > 0) {
      for (const img of images) {
        try {
          const formData = new FormData();
          let imgBuf;

          if (img.startsWith("/uploads/")) {
            const localPath = path.join(__dirname, "..", "..", "public", img);
            imgBuf = fs.readFileSync(localPath);
          } else if (img.startsWith("http")) {
            const res = await fetch(img);
            imgBuf = Buffer.from(await res.arrayBuffer());
          } else if (fs.existsSync(img)) {
            imgBuf = fs.readFileSync(img);
          }

          if (imgBuf) {
            const blob = new Blob([imgBuf], { type: "image/jpeg" });
            formData.append("file", blob, "image.jpg");

            const uploadRes = await fetch(
              "https://creator.xiaohongshu.com/api/sns/web/v1/upload",
              {
                method: "POST",
                headers: {
                  "Cookie": cookieHeader,
                  "Origin": "https://creator.xiaohongshu.com",
                  "Referer": "https://creator.xiaohongshu.com/publish/publish",
                },
                body: formData,
              }
            );

            if (uploadRes.ok) {
              const data = await uploadRes.json();
              if (data.success && data.data?.fileId) {
                imageIds.push(data.data.fileId);
              }
            }
          }
        } catch (e) {
          console.error("Image upload failed:", e.message);
        }
      }
    }

    const noteData = {
      title,
      desc: body,
      type: imageIds.length > 0 ? "image" : "text",
      images: imageIds.map((id, i) => ({
        fileId: id,
        width: 800,
        height: 800,
        format: "jpg",
      })),
      tag_list: (Array.isArray(tags) ? tags : (tags || "").split(/\s+/).filter(Boolean)).map((t) => ({
        name: t.startsWith("#") ? t.slice(1) : t,
        type: "topic",
      })),
      post_loc: "",
      is_private: false,
    };

    const noteRes = await fetch(
      "https://creator.xiaohongshu.com/api/sns/web/v1/note",
      {
        method: "POST",
        headers,
        body: JSON.stringify(noteData),
      }
    );

    if (noteRes.ok) {
      const result = await noteRes.json();
      if (result.success) {
        return { success: true, status: "published", reason: "API发布成功！" };
      }
      return { success: false, reason: "API返回错误: " + JSON.stringify(result).substring(0, 100) };
    }

    return { success: false, reason: `API请求失败: HTTP ${noteRes.status}` };
  } catch (e) {
    return { success: false, reason: `API方案失败: ${e.message}` };
  }
}

// ─── Main publish function ───

async function publishToXHS({ title, body, tags, images, cookies }) {
  const record = {
    id: `xhs_${Date.now()}`,
    title,
    body,
    tags: Array.isArray(tags) ? tags : (tags || "").split(/\s+/).filter(Boolean),
    imageCount: images?.length || 0,
    status: "publishing",
    createdAt: new Date().toISOString(),
    note: "正在发布...",
  };

  // Primary: Browser automation
  try {
    record.note = "方案一：浏览器自动化发布...";
    const result = await publishViaBrowser({ title, body, tags, images, cookies });

    if (result.success || result.status === "published") {
      record.status = result.status;
      record.note = result.reason;
      return saveHistory(record);
    }

    if (result.status === "submitted") {
      record.status = "submitted";
      record.note = result.reason;
      return saveHistory(record);
    }

    if (result.status === "draft") {
      record.status = "draft";
      record.note = result.reason + "\n填写详情: " + (result.fillResult || []).join(", ");
      return saveHistory(record);
    }

    if (result.reason?.includes("Cookie已过期")) {
      record.status = "failed";
      record.note = result.reason;
      return saveHistory(record);
    }

    record.status = "failed";
    record.note = "浏览器方案: " + result.reason;
  } catch (e) {
    console.error("Browser publish error:", e.message);
    record.note = "浏览器方案失败: " + e.message;
    await closeBrowser();
  }

  // Fallback: HTTP API
  try {
    record.note += " | 方案二：API发布...";
    const apiResult = await publishViaAPI({ title, body, tags, images, cookies });

    if (apiResult.success) {
      record.status = apiResult.status || "published";
      record.note = apiResult.reason;
    } else {
      record.status = "failed";
      record.note = "两种方案均失败。浏览器: " + record.note + " | API: " + apiResult.reason +
        "\n建议：请在小红书创作者平台手动发布笔记。";
    }
  } catch (e) {
    record.status = "failed";
    record.note += " | API方案失败: " + e.message;
  }

  return saveHistory(record);
}

// ─── History management ───

function getPublishHistory() { return loadHistory(); }
function getPublishById(id) { return loadHistory().find((h) => h.id === id); }

function deletePublishById(id) {
  const history = loadHistory();
  const filtered = history.filter((h) => h.id !== id);
  if (filtered.length === history.length) return false;
  fs.writeFileSync(HISTORY_PATH, JSON.stringify(filtered, null, 2), "utf-8");
  return true;
}

function clearAllHistory() {
  fs.writeFileSync(HISTORY_PATH, JSON.stringify([], null, 2), "utf-8");
  return true;
}

async function retryPublish(id, cookies) {
  const history = loadHistory();
  const record = history.find((h) => h.id === id);
  if (!record) throw new Error("记录不存在");
  if (record.status === "published") throw new Error("该笔记已发布成功");

  const filtered = history.filter((h) => h.id !== id);
  fs.writeFileSync(HISTORY_PATH, JSON.stringify(filtered, null, 2), "utf-8");

  return publishToXHS({
    title: record.title,
    body: record.body,
    tags: record.tags,
    images: record.images || [],
    cookies,
  });
}

export {
  publishToXHS, retryPublish,
  getPublishHistory, getPublishById, deletePublishById, clearAllHistory,
  closeBrowser, getBrowser,
};
