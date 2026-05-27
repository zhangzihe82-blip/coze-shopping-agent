import { Router } from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import { saveAccount, getAccount, disconnectAccount } from "../xhs/account.js";
import { generateCopy, generateCopyVariants } from "../xhs/contentGen.js";
import { publishToXHS, getPublishHistory } from "../xhs/publisher.js";

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

// 一键发布
router.post("/xhs/publish", async (req, res) => {
  const { title, body, tags, images, api_key } = req.body;
  if (!title || !body) {
    return res.status(400).json({ ok: false, error: "标题和正文不能为空" });
  }

  try {
    const account = getAccount();
    const record = await publishToXHS({
      title,
      body,
      tags,
      images: images || [],
      cookies: account?.cookies,
    });
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

export default router;
