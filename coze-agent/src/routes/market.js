import { Router } from "express";
import { getMarketTrends, searchPolicyNews } from "../market/hotTopics.js";
import { analyzeCompetitors } from "../market/competitor.js";
import { generateDailyReport } from "../market/dailyReport.js";

const router = Router();

// 一键获取市场热销趋势
router.post("/market/trends", async (req, res) => {
  const { api_key } = req.body;
  try {
    const result = await getMarketTrends(api_key || "");
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// 关键词搜索政策与新闻
router.post("/market/policy-news", async (req, res) => {
  const { api_key, keyword } = req.body;
  if (!keyword) {
    return res.status(400).json({ ok: false, error: "请输入搜索关键词" });
  }
  try {
    const result = await searchPolicyNews(keyword, api_key || "");
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// 竞品分析
router.post("/market/competitors", async (req, res) => {
  const { api_key, category } = req.body;
  try {
    const result = await analyzeCompetitors(category || "", api_key || "");
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// 每日总结
router.post("/market/daily-report", async (req, res) => {
  const { api_key, notes } = req.body;
  try {
    const result = await generateDailyReport(api_key || "", notes || "");
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

export default router;
