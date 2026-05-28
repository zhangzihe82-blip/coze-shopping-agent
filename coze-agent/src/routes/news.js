import { Router } from "express";
import { getNewsFeed } from "../news/feed.js";

const router = Router();

// 获取实时新闻简报 — 页面打开时自动加载
router.post("/news/feed", async (req, res) => {
  const { api_key } = req.body;
  try {
    const result = await getNewsFeed(api_key || "");
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

export default router;
