import { Router } from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import { saveAccount, getAccount, disconnectAccount } from "../xhs/account.js";
import { generateCopy, generateCopyVariants } from "../xhs/contentGen.js";
import { publishToXHS, retryPublish, getPublishHistory, deletePublishById, clearAllHistory, getBrowser } from "../xhs/publisher.js";
import { publishWithAgent, getAgentMemory, getStrategyStats, getBestStrategy } from "../xhs/publishAgent.js";
import { getOptimizerStatus, runHealthCheck, getRecentLogs } from "../xhs/optimizerAgent.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = Router();

// 文件上传
const storage = multer.diskStorage({
  destination: path.join(__dirname, "..", "..", "public", "uploads"),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `xhs_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /\.(jpg|jpeg|png|gif|webp|mp4|mov|avi)$/i;
    if (allowed.test(path.extname(file.originalname))) {
      cb(null, true);
    } else {
      cb(new Error("仅支持图片(jpg/png/gif/webp)和视频(mp4/mov/avi)"));
    }
  },
});

// 上传素材
router.post("/xhs/upload", upload.array("files", 9), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ ok: false, error: "请选择文件" });
  }
  const files = req.files.map((f) => ({
    filename: f.filename,
    originalName: f.originalname,
    url: `/uploads/${f.filename}`,
    type: f.mimetype,
    size: f.size,
  }));
  res.json({ ok: true, files });
});

// 生成笔记文案
router.post("/xhs/generate-copy", async (req, res) => {
  const { product_info, api_key, variants } = req.body;
  if (!product_info) {
    return res.status(400).json({ ok: false, error: "请提供商品信息" });
  }

  try {
    if (variants) {
      const result = await generateCopyVariants(product_info, api_key || "");
      res.json({ ok: true, variants: result });
    } else {
      const result = await generateCopy(product_info, api_key || "");
      res.json({ ok: true, ...result });
    }
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// 一键发布（使用智能发布Agent，含记忆和学习能力）
router.post("/xhs/publish-agent", async (req, res) => {
  const { title, body, tags, images, api_key } = req.body;
  if (!title || !body) {
    return res.status(400).json({ ok: false, error: "标题和正文不能为空" });
  }

  const account = getAccount();
  if (!account || !account.cookies || Object.keys(account.cookies).length === 0) {
    return res.status(400).json({
      ok: false,
      error: "请先关联小红书账号（需要提供Cookie）",
      needAccount: true,
    });
  }

  try {
    const record = await publishWithAgent({
      title, body, tags,
      images: images || [],
      cookies: account.cookies,
    });
    res.json({ ok: true, record });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// 获取发布Agent记忆和策略统计
router.get("/xhs/publish-agent/memory", (req, res) => {
  res.json({
    ok: true,
    memory: getAgentMemory(),
    strategies: getStrategyStats(),
    best: getBestStrategy(),
  });
});

// 一键发布（原版）
router.post("/xhs/publish", async (req, res) => {
  const { title, body, tags, images, api_key } = req.body;
  if (!title || !body) {
    return res.status(400).json({ ok: false, error: "标题和正文不能为空" });
  }

  const account = getAccount();
  if (!account || !account.cookies || Object.keys(account.cookies).length === 0) {
    return res.status(400).json({
      ok: false,
      error: "请先关联小红书账号（需要提供Cookie）",
      needAccount: true,
    });
  }

  try {
    const record = await publishToXHS({
      title,
      body,
      tags,
      images: images || [],
      cookies: account.cookies,
    });
    res.json({ ok: true, record });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// 重试发布
router.post("/xhs/publish/:id/retry", async (req, res) => {
  const account = getAccount();
  if (!account || !account.cookies || Object.keys(account.cookies).length === 0) {
    return res.status(400).json({ ok: false, error: "请先关联小红书账号（需要提供Cookie）" });
  }

  try {
    const record = await retryPublish(req.params.id, account.cookies);
    res.json({ ok: true, record });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// 账号关联
router.post("/xhs/account/connect", (req, res) => {
  const { nickname, cookies } = req.body;
  if (!nickname) {
    return res.status(400).json({ ok: false, error: "请提供账号昵称" });
  }
  const account = saveAccount({ nickname, cookies: cookies || {}, status: "connected" });
  res.json({ ok: true, account });
});

// 获取账号状态
router.get("/xhs/account", (req, res) => {
  const account = getAccount();
  res.json({ ok: true, account });
});

// 断开账号
router.delete("/xhs/account", (req, res) => {
  disconnectAccount();
  res.json({ ok: true });
});

// 发布历史
router.get("/xhs/history", (req, res) => {
  res.json({ ok: true, history: getPublishHistory() });
});

// 删除单条历史
router.delete("/xhs/history/:id", (req, res) => {
  const deleted = deletePublishById(req.params.id);
  if (deleted) {
    res.json({ ok: true });
  } else {
    res.status(404).json({ ok: false, error: "记录不存在" });
  }
});

// 一键清空全部历史
router.delete("/xhs/history", (req, res) => {
  clearAllHistory();
  res.json({ ok: true });
});

// 后台优化器状态
router.get("/xhs/optimizer/status", (req, res) => {
  res.json({ ok: true, ...getOptimizerStatus() });
});

// 手动触发健康检查
router.post("/xhs/optimizer/run", async (req, res) => {
  try {
    const result = await runHealthCheck();
    res.json({ ok: true, result });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// 优化器检查日志
router.get("/xhs/optimizer/log", (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  res.json({ ok: true, logs: getRecentLogs(limit) });
});

// 自动关联账号（从浏览器提取Cookie）
router.post("/xhs/account/auto-connect", async (req, res) => {
  let page;
  let keepOpen = false;
  const MAX_WAIT_LOGIN_MS = 120000; // 最多等 2 分钟让用户登录
  try {
    const browser = await getBrowser();
    page = await browser.newPage();

    await page.goto("https://creator.xiaohongshu.com", {
      waitUntil: "networkidle2", timeout: 30000,
    });
    await new Promise(r => setTimeout(r, 3000));

    let url = page.url();

    // 如果未登录，轮询等待用户手动登录
    if (url.includes("login") || url.includes("signin")) {
      console.log("[AutoConnect] 检测到登录页面，等待用户登录...");
      const startTime = Date.now();

      while (Date.now() - startTime < MAX_WAIT_LOGIN_MS) {
        await new Promise(r => setTimeout(r, 3000));
        url = page.url();
        if (!url.includes("login") && !url.includes("signin")) {
          console.log("[AutoConnect] 登录成功！");
          break;
        }
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        console.log(`[AutoConnect] 等待登录中... (${elapsed}s)`);
      }

      // 超时仍未登录
      if (url.includes("login") || url.includes("signin")) {
        keepOpen = true;
        return res.json({
          ok: false,
          needLogin: true,
          message: "登录等待超时。浏览器页面已保持打开，请完成登录后再次点击「自动关联」。",
        });
      }
    }

    // 提取所有 Cookie
    const rawCookies = await page.cookies();
    const cookies = {};
    for (const c of rawCookies) {
      cookies[c.name] = c.value;
    }

    // 抓取用户昵称
    const userInfo = await page.evaluate(() => {
      const selectors = [
        ".user-info .name", ".creator-name", ".user-name", ".username",
        "[class*='user'] [class*='name']", "header .name",
      ];
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el && el.textContent.trim()) return { nickname: el.textContent.trim() };
      }
      const avatarImg = document.querySelector('img[src*="avatar"], img[src*="头像"]');
      if (avatarImg) {
        let node = avatarImg.parentElement;
        for (let i = 0; i < 5 && node; i++) {
          const textEl = node.querySelector("span, div.name, div.username");
          if (textEl && textEl.textContent.trim()) return { nickname: textEl.textContent.trim() };
          node = node.parentElement;
        }
      }
      return { nickname: "" };
    });

    // 抓取头像
    const avatar = await page.evaluate(() => {
      const img = document.querySelector('img[src*="avatar"], img[src*="头像"]');
      return img ? img.src : "";
    });

    // 保存账号
    const account = saveAccount({
      nickname: userInfo.nickname || "小红书创作者",
      avatar,
      cookies,
    });

    keepOpen = true; // 成功后也保持页面打开
    res.json({
      ok: true,
      account: {
        nickname: account.nickname,
        avatar: account.avatar,
        cookieCount: account.cookieCount,
        status: account.status,
      },
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  } finally {
    if (page && !keepOpen) await page.close().catch(() => {});
  }
});

export default router;
