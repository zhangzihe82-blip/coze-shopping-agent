import { Router } from "express";
import { getHotTopics } from "../market/hotTopics.js";
import { analyzeCompetitors } from "../market/competitor.js";
import { generateDailyReport } from "../market/dailyReport.js";

const router = Router();

// 市场热点
router.post("/market/hot-topics", async (req, res) => {
  const { api_key, category } = req.body;
  try {
    const result = await getHotTopics(api_key || "", category || "");
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
