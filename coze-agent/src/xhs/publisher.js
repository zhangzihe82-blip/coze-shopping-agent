import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import puppeteer from "puppeteer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HISTORY_PATH = path.join(__dirname, "..", "..", "data", "xhs_publish_history.json");
const USER_DATA_DIR = path.join(__dirname, "..", "..", "data", "xhs_browser_profile");

const CHROME_PATH = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";

let _browser = null;

async function getBrowser() {
  if (_browser && _browser.isConnected()) return _browser;

  if (!fs.existsSync(USER_DATA_DIR)) {
    fs.mkdirSync(USER_DATA_DIR, { recursive: true });
  }

  _browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: false, // XHS needs real browser context to pass anti-bot checks
    userDataDir: USER_DATA_DIR,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-blink-features=AutomationControlled",
      "--window-size=1280,900",
    ],
    ignoreDefaultArgs: ["--enable-automation"],
    defaultViewport: { width: 1280, height: 900 },
  });

  return _browser;
}

async function closeBrowser() {
  if (_browser) {
    await _browser.close().catch(() => {});
    _browser = null;
  }
}

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

// ─── Core: Real publishing via browser automation ───

async function publishToXHS({ title, body, tags, images, cookies }) {
  const record = {
    id: `xhs_${Date.now()}`,
    title,
    body,
    tags: Array.isArray(tags) ? tags : (tags || "").split(/\s+/).filter(Boolean),
    imageCount: images?.length || 0,
    status: "publishing",
    createdAt: new Date().toISOString(),
    note: "正在通过浏览器自动化发布...",
  };

  try {
    const browser = await getBrowser();
    const page = await browser.newPage();

    // Set cookies for authentication
    if (cookies && Object.keys(cookies).length > 0) {
      const cookieEntries = Object.entries(cookies).map(([name, value]) => ({
        name,
        value: String(value),
        domain: ".xiaohongshu.com",
        path: "/",
      }));
      await page.setCookie(...cookieEntries);
    }

    // Step 1: Navigate to XHS Creator Platform
    record.note = "正在打开小红书创作者平台...";
    await page.goto("https://creator.xiaohongshu.com", {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    // Check if we need login
    const currentUrl = page.url();
    if (currentUrl.includes("login") || currentUrl.includes("signin")) {
      await page.close();
      record.status = "failed";
      record.note = "Cookie已过期，请在浏览器中重新登录小红书创作者平台，然后重新关联账号（提供新的Cookie）。";
      return saveHistory(record);
    }

    // Step 2: Click "发布笔记" button
    record.note = "正在进入发布页面...";
    const publishButtonSelectors = [
      'a[href*="publish"]',
      'button:has-text("发布笔记")',
      'span:has-text("发布笔记")',
      '[class*="publish"]',
      'a:has-text("发布")',
      'div:has-text("发布笔记")',
    ];

    let clicked = false;
    for (const sel of publishButtonSelectors) {
      try {
        await page.waitForSelector(sel, { timeout: 3000 });
        await page.click(sel);
        clicked = true;
        break;
      } catch {}
    }

    if (!clicked) {
      // Try navigating directly to publish page
      await page.goto("https://creator.xiaohongshu.com/publish/publish", {
        waitUntil: "networkidle2",
        timeout: 15000,
      });
    }

    await new Promise((r) => setTimeout(r, 2000));

    // Step 3: Upload images
    if (images && images.length > 0) {
      record.note = `正在上传 ${images.length} 张图片...`;

      // Find the file input element
      const fileInputSelectors = [
        'input[type="file"][accept*="image"]',
        'input[type="file"]',
        '.upload-input input[type="file"]',
        '[class*="upload"] input[type="file"]',
      ];

      let fileInput = null;
      for (const sel of fileInputSelectors) {
        try {
          fileInput = await page.$(sel);
          if (fileInput) break;
        } catch {}
      }

      if (fileInput) {
        const localPaths = [];
        for (const img of images) {
          // Convert URL to local file path
          let localPath = img;
          if (img.startsWith("/uploads/")) {
            localPath = path.join(__dirname, "..", "..", "public", img);
          } else if (img.startsWith("http")) {
            // Download remote image first
            const dlPath = path.join(__dirname, "..", "..", "data", "xhs_temp_" + Date.now() + ".jpg");
            try {
              const res = await fetch(img);
              const buf = Buffer.from(await res.arrayBuffer());
              fs.writeFileSync(dlPath, buf);
              localPath = dlPath;
            } catch {
              continue;
            }
          }
          if (fs.existsSync(localPath)) {
            localPaths.push(localPath);
          }
        }

        if (localPaths.length > 0) {
          await fileInput.uploadFile(...localPaths);
          await new Promise((r) => setTimeout(r, 3000)); // Wait for upload
        }

        // Clean up temp files
        for (const lp of localPaths) {
          if (lp.includes("xhs_temp_")) fs.unlinkSync(lp).catch(() => {});
        }
      }
    }

    // Step 4: Fill in title
    record.note = "正在填写标题...";
    const titleSelectors = [
      'input[placeholder*="标题"]',
      'input[class*="title"]',
      '[class*="title"] input',
      'textarea[placeholder*="标题"]',
    ];
    for (const sel of titleSelectors) {
      try {
        const input = await page.$(sel);
        if (input) {
          await input.click();
          await new Promise((r) => setTimeout(r, 500));
          await input.type(title, { delay: 50 });
          break;
        }
      } catch {}
    }

    // Step 5: Fill in body/content
    record.note = "正在填写正文...";
    const bodySelectors = [
      '[placeholder*="正文"]',
      '[placeholder*="内容"]',
      'div[contenteditable="true"]',
      '[class*="editor"] [contenteditable="true"]',
      '[class*="content"] [contenteditable="true"]',
      'textarea[placeholder*="正文"]',
      'textarea[placeholder*="内容"]',
    ];
    let bodyFilled = false;
    for (const sel of bodySelectors) {
      try {
        const el = await page.$(sel);
        if (el) {
          await el.click();
          await new Promise((r) => setTimeout(r, 500));
          // Clear existing content and type new content
          await el.evaluate((node) => {
            if (node.isContentEditable) node.textContent = "";
            else node.value = "";
          });
          await el.type(body, { delay: 30 });
          bodyFilled = true;
          break;
        }
      } catch {}
    }

    if (!bodyFilled) {
      // Try using the rich text editor approach
      await page.keyboard.type(body, { delay: 30 });
    }

    // Step 6: Add tags
    if (record.tags.length > 0) {
      record.note = "正在添加标签...";
      const tagSelectors = [
        'input[placeholder*="标签"]',
        'input[placeholder*="话题"]',
        '[class*="tag"] input',
        '[class*="topic"] input',
      ];
      for (const sel of tagSelectors) {
        try {
          const tagInput = await page.$(sel);
          if (tagInput) {
            await tagInput.click();
            for (const tag of record.tags) {
              const tagName = tag.startsWith("#") ? tag : "#" + tag;
              await tagInput.type(tagName, { delay: 50 });
              await new Promise((r) => setTimeout(r, 800));
              await page.keyboard.press("Enter");
              await new Promise((r) => setTimeout(r, 500));
            }
            break;
          }
        } catch {}
      }
    }

    await new Promise((r) => setTimeout(r, 1000));

    // Step 7: Click publish / submit
    record.note = "正在提交发布...";
    const submitSelectors = [
      'button:has-text("发布")',
      'span:has-text("发布")',
      '[class*="publish-btn"]',
      '[class*="submit"]',
      'button:has-text("提交")',
      'div[role="button"]:has-text("发布")',
    ];

    let published = false;
    for (const sel of submitSelectors) {
      try {
        const btn = await page.$(sel);
        if (btn) {
          const isDisabled = await btn.evaluate((el) => {
            return el.disabled || el.getAttribute("aria-disabled") === "true";
          });
          if (!isDisabled) {
            await btn.click();
            published = true;
            break;
          }
        }
      } catch {}
    }

    if (published) {
      await new Promise((r) => setTimeout(r, 5000));

      // Check result
      const resultUrl = page.url();
      if (resultUrl.includes("success") || resultUrl.includes("published") || resultUrl.includes("content")) {
        record.status = "published";
        record.note = "笔记发布成功！请前往小红书创作者平台查看。";
      } else {
        record.status = "submitted";
        record.note = "笔记已提交。由于自动化限制，请在创作者平台确认发布状态。如发布失败，请手动发布。";
      }
    } else {
      record.status = "draft";
      record.note = "笔记内容已填写完毕，但未能自动点击发布按钮。请在浏览器中检查并手动点击发布。（浏览器窗口已打开）";
    }

    await page.close();
    return saveHistory(record);
  } catch (e) {
    console.error("XHS publish error:", e.message);
    record.status = "failed";
    record.note = `发布失败: ${e.message}`;
    return saveHistory(record);
  }
}

function getPublishHistory() {
  return loadHistory();
}

function getPublishById(id) {
  return loadHistory().find((h) => h.id === id);
}

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

// Retry a failed publish
async function retryPublish(id, cookies) {
  const history = loadHistory();
  const record = history.find((h) => h.id === id);
  if (!record) throw new Error("记录不存在");
  if (record.status === "published") throw new Error("该笔记已发布成功");

  // Remove old record and republish
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

export { publishToXHS, retryPublish, getPublishHistory, getPublishById, deletePublishById, clearAllHistory, closeBrowser };
