import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import puppeteer from "puppeteer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "data");

const accountPath = path.join(dataDir, "xhs_account.json");
const account = JSON.parse(fs.readFileSync(accountPath, "utf-8"));
const cookies = account.cookies || {};

const profileDir = path.join(dataDir, "xhs_e2e_test");
for (const f of ["SingletonLock", "SingletonCookie", "SingletonSocket"]) {
  try { fs.unlinkSync(path.join(profileDir, f)); } catch {}
}

console.log("╔══════════════════════════════════════╗");
console.log("║   E2E XHS PUBLISH TEST             ║");
console.log("╚══════════════════════════════════════╝\n");

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: false,
  userDataDir: profileDir,
  args: ["--no-sandbox", "--disable-blink-features=AutomationControlled", "--window-size=1400,950"],
  ignoreDefaultArgs: ["--enable-automation"],
  defaultViewport: { width: 1400, height: 950 },
});

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

const results = { steps: [], success: false, error: null };

try {
  const page = await browser.newPage();

  // Force Shadow DOM to open mode
  await page.evaluateOnNewDocument(() => {
    const origAttachShadow = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function (init) {
      return origAttachShadow.call(this, { ...init, mode: "open" });
    };
  });

  // Set cookies
  const cookieEntries = Object.entries(cookies).map(([name, value]) => ({
    name, value: String(value), domain: ".xiaohongshu.com", path: "/",
  }));
  await page.setCookie(...cookieEntries);

  // Step 1: Navigate
  console.log("[1/6] Navigating to publish page...");
  await page.goto("https://creator.xiaohongshu.com/publish/publish", {
    waitUntil: "networkidle2", timeout: 30000,
  });
  await sleep(3000);

  if (page.url().includes("login")) {
    throw new Error("Cookie expired - need to re-login");
  }
  results.steps.push({ step: "navigate", ok: true });

  // Step 2: Click 上传图文
  console.log("[2/6] Clicking 上传图文...");
  const tabOk = await page.evaluate(() => {
    const tab = Array.from(document.querySelectorAll("span.title"))
      .find(s => s.textContent.trim() === "上传图文" && s.offsetParent !== null);
    if (tab) { tab.click(); return true; }
    return false;
  });
  if (!tabOk) throw new Error("Upload tab not found");
  await sleep(3000);
  results.steps.push({ step: "tab", ok: true });

  // Step 3: Upload image
  console.log("[3/6] Uploading image...");
  const pngPath = path.join(dataDir, "e2e_test.png");
  fs.writeFileSync(pngPath, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64"));
  const fileInput = await page.$('input[type="file"]');
  if (fileInput) await fileInput.uploadFile(pngPath);
  else { console.log("  WARNING: No file input found"); }
  await sleep(5000);
  results.steps.push({ step: "upload", ok: true });

  // Step 4: Fill title
  console.log("[4/6] Filling title...");
  const titleOk = await page.evaluate(() => {
    const input = document.querySelector('input[placeholder*="标题"]');
    if (!input) return false;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(input, "【测评】平价降噪蓝牙耳机推荐 - E2E测试");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  });
  await sleep(500);
  results.steps.push({ step: "title", ok: titleOk });

  // Step 5: Fill body
  console.log("[5/6] Filling body...");
  const bodyOk = await page.evaluate(() => {
    const pm = document.querySelector(".ProseMirror");
    if (!pm?.editor) return false;
    pm.editor.chain()
      .setContent("<p>最近挖到一款宝藏蓝牙耳机！降噪效果一绝，续航30小时，颜值还超高～学生党、通勤党闭眼入！E2E自动化测试发布</p>")
      .run();
    return true;
  });
  await sleep(1500);
  results.steps.push({ step: "body", ok: bodyOk });

  // Step 6: Click publish via Shadow DOM coordinates
  console.log("[6/6] Clicking publish via Shadow DOM...");
  const btnCoords = await page.evaluate(() => {
    const btn = document.querySelector("xhs-publish-btn");
    if (!btn || !btn.shadowRoot) return null;
    const publishBtn = Array.from(btn.shadowRoot.querySelectorAll("button"))
      .find(el => el.textContent.trim() === "发布");
    if (!publishBtn) return null;
    const r = publishBtn.getBoundingClientRect();
    return { cx: r.x + r.width / 2, cy: r.y + r.height / 2, disabled: publishBtn.disabled };
  });

  if (!btnCoords) throw new Error("Cannot find publish button in shadow DOM");
  if (btnCoords.disabled) {
    console.log("  Button disabled - triggering validation...");
    await page.evaluate(() => {
      const input = document.querySelector('input[placeholder*="标题"]');
      if (input) { input.focus(); input.blur(); }
      document.body.click();
    });
    await sleep(1000);
    const recheck = await page.evaluate(() => {
      const btn = document.querySelector("xhs-publish-btn");
      if (!btn || !btn.shadowRoot) return null;
      const pb = Array.from(btn.shadowRoot.querySelectorAll("button"))
        .find(el => el.textContent.trim() === "发布");
      if (!pb) return null;
      const r = pb.getBoundingClientRect();
      return { cx: r.x + r.width / 2, cy: r.y + r.height / 2, disabled: pb.disabled };
    });
    if (recheck && !recheck.disabled) {
      btnCoords.cx = recheck.cx;
      btnCoords.cy = recheck.cy;
    }
  }

  console.log(`  Clicking at (${btnCoords.cx}, ${btnCoords.cy})...`);
  await page.mouse.click(btnCoords.cx, btnCoords.cy);
  results.steps.push({ step: "publish-click", ok: true });

  // Wait for result
  await sleep(5000);

  const finalUrl = page.url();
  console.log(`  Final URL: ${finalUrl}`);

  if (finalUrl.includes("publish/success")) {
    results.success = true;
    results.steps.push({ step: "result", ok: true, url: finalUrl });
    console.log("\n*** PUBLISH SUCCESSFUL! ***\n");
  } else {
    // Check for dialog
    const dialog = await page.evaluate(() => {
      const dlg = document.querySelector(".el-overlay-dialog, .el-message-box, [class*=dialog]");
      if (!dlg) return null;
      const r = dlg.getBoundingClientRect();
      if (r.width < 20) return null;
      return {
        text: (dlg.textContent || "").trim().substring(0, 300),
        buttons: Array.from(dlg.querySelectorAll("button"))
          .filter(b => b.offsetParent !== null)
          .map(b => (b.textContent || "").trim()),
      };
    });

    if (dialog) {
      console.log("  Dialog found:", JSON.stringify(dialog));
      const confirmBtn = dialog.buttons.find(b => b.includes("发布") || b.includes("确定"));
      if (confirmBtn) {
        console.log(`  Clicking confirm: "${confirmBtn}"`);
        await page.evaluate((text) => {
          const dlg = document.querySelector(".el-overlay-dialog, .el-message-box");
          const btn = Array.from(dlg.querySelectorAll("button"))
            .find(b => (b.textContent || "").trim() === text);
          if (btn) btn.click();
        }, confirmBtn);
        await sleep(5000);
        results.success = page.url().includes("publish/success");
      }
    }
  }

} catch (e) {
  results.error = e.message;
  console.error("ERROR:", e.message);
} finally {
  // Save results
  const resultPath = path.join(dataDir, "e2e_result.json");
  results.timestamp = new Date().toISOString();
  fs.writeFileSync(resultPath, JSON.stringify(results, null, 2));

  console.log("\nResults saved to:", resultPath);
  console.log(JSON.stringify(results, null, 2));

  console.log("\nBrowser open for 30s - verify publish status");
  await new Promise(r => setTimeout(r, 30000));
  await browser.close();
  console.log("Done");
}
process.exit(0);
