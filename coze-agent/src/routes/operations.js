import { Router } from "express";
import { monitorRules } from "../operations/ruleMonitor.js";
import { recommendProduct } from "../operations/productPick.js";
import { generateContent } from "../operations/contentGen.js";
import { getServiceReply } from "../operations/serviceReply.js";
import { getPricingAdvice } from "../operations/pricingStrategy.js";

const router = Router();

// 平台规则变动监控
router.post("/operations/rules", async (req, res) => {
  const { api_key, platform } = req.body;
  try {
    const result = await monitorRules(platform || "", api_key || "");
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// 选品推荐
router.post("/operations/pick", async (req, res) => {
  const { api_key, budget, platform, category } = req.body;
  try {
    const result = await recommendProduct({ budget, platform, category }, api_key || "");
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// 爆款内容生成
router.post("/operations/content", async (req, res) => {
  const { api_key, product, platform, audience, priceRange } = req.body;
  try {
    const result = await generateContent({ product, platform, audience, priceRange }, api_key || "");
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// 客服话术
router.post("/operations/service", async (req, res) => {
  const { api_key, scene, context } = req.body;
  try {
    const result = await getServiceReply(scene || "", context || "", api_key || "");
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// 定价策略
router.post("/operations/pricing", async (req, res) => {
  const { api_key, product, cost, platform, competitors } = req.body;
  try {
    const result = await getPricingAdvice({ product, cost, platform, competitors }, api_key || "");
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

export default router;
