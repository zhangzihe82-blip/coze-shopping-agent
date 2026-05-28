import { Router } from "express";
import { monitorRules, RULES_PROMPT } from "../operations/ruleMonitor.js";
import { recommendProduct, PICK_PROMPT } from "../operations/productPick.js";
import { generateContent, CONTENT_PROMPT } from "../operations/contentGen.js";
import { getServiceReply, SERVICE_PROMPT } from "../operations/serviceReply.js";
import { getPricingAdvice, PRICING_PROMPT } from "../operations/pricingStrategy.js";
import { streamSSE } from "../llm/client.js";

const router = Router();

// ─── 非流式（兼容） ───

router.post("/operations/rules", async (req, res) => {
  const { api_key, platform } = req.body;
  try {
    const result = await monitorRules(platform || "", api_key || "");
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.post("/operations/pick", async (req, res) => {
  const { api_key, budget, platform, category } = req.body;
  try {
    const result = await recommendProduct({ budget, platform, category }, api_key || "");
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.post("/operations/content", async (req, res) => {
  const { api_key, product, platform, audience, priceRange } = req.body;
  try {
    const result = await generateContent({ product, platform, audience, priceRange }, api_key || "");
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.post("/operations/service", async (req, res) => {
  const { api_key, scene, context } = req.body;
  try {
    const result = await getServiceReply(scene || "", context || "", api_key || "");
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.post("/operations/pricing", async (req, res) => {
  const { api_key, product, cost, platform, competitors } = req.body;
  try {
    const result = await getPricingAdvice({ product, cost, platform, competitors }, api_key || "");
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ─── SSE 流式端点（打字机效果） ───

router.post("/operations/rules-stream", async (req, res) => {
  const { api_key, platform } = req.body;
  const platformHint = platform ? `重点关注平台：${platform}` : "关注所有主流平台（淘宝、京东、拼多多、抖音电商）";
  await streamSSE(RULES_PROMPT, `请分析当前各电商平台的最新规则变动和应对策略。${platformHint}。请基于你最新的知识给出分析。`, api_key || "", res);
});

router.post("/operations/pick-stream", async (req, res) => {
  const { api_key, budget, platform, category } = req.body;
  const now = new Date();
  const userPrompt = [
    `当前时间：${now.getFullYear()}年${now.getMonth() + 1}月`,
    `可用预算：${budget || "1-5万"}`,
    `目标平台：${platform || "抖音"}`,
    category ? `偏好品类：${category}` : "无特定品类偏好，请广泛推荐",
    `请根据以上条件，给出最适合的选品方向和具体运营建议。`,
  ].join("\n");
  await streamSSE(PICK_PROMPT, userPrompt, api_key || "", res);
});

router.post("/operations/content-stream", async (req, res) => {
  const { api_key, product, platform, audience, priceRange } = req.body;
  if (!product || !product.trim()) {
    return res.status(400).json({ ok: false, error: "请填写商品信息" });
  }
  const userPrompt = [
    `商品：${product}`,
    `目标平台：${platform || "抖音"}`,
    audience ? `目标人群：${audience}` : "",
    priceRange ? `价格区间：${priceRange}` : "",
    `请为我生成完整的营销内容方案，要求口语化、有爆款潜质，直接可用。`,
  ].filter(Boolean).join("\n");
  await streamSSE(CONTENT_PROMPT, userPrompt, api_key || "", res);
});

router.post("/operations/service-stream", async (req, res) => {
  const { api_key, scene, context } = req.body;
  if (!scene || !scene.trim()) {
    return res.status(400).json({ ok: false, error: "请选择客服场景" });
  }
  const SCENE_HINTS = {
    badReview: "场景：收到了差评，需要回复买家争取改评",
    refund: "场景：买家要求退货退款，商品已拆封",
    complaint: "场景：买家投诉到平台，需要和买家协商撤诉",
    askReview: "场景：买家已收货但未评价，需要引导给好评",
  };
  const sceneDesc = SCENE_HINTS[scene] || scene;
  const userPrompt = [
    `场景描述：${sceneDesc}`,
    context ? `补充信息：${context}` : "",
    `请给出专业的客服回复话术和应对策略。`,
  ].filter(Boolean).join("\n");
  await streamSSE(SERVICE_PROMPT, userPrompt, api_key || "", res);
});

router.post("/operations/pricing-stream", async (req, res) => {
  const { api_key, product, cost, platform, competitors } = req.body;
  if (!product || !product.trim()) {
    return res.status(400).json({ ok: false, error: "请填写商品信息和成本" });
  }
  const userPrompt = [
    `商品：${product}`,
    cost ? `成本（含运费）：${cost}` : "成本未知，请根据市场行情估算",
    platform ? `目标平台：${platform}` : "",
    competitors ? `竞品参考价：${competitors}` : "",
    `请给出完整的定价策略和促销规划。`,
  ].filter(Boolean).join("\n");
  await streamSSE(PRICING_PROMPT, userPrompt, api_key || "", res);
});

export default router;
