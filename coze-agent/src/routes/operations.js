import { Router } from "express";
import { monitorRules, RULES_PROMPT } from "../operations/ruleMonitor.js";
import { recommendProduct, PICK_PROMPT } from "../operations/productPick.js";
import { generateContent, CONTENT_PROMPT } from "../operations/contentGen.js";
import { getServiceReply, SERVICE_PROMPT } from "../operations/serviceReply.js";
import { getPricingAdvice, PRICING_PROMPT } from "../operations/pricingStrategy.js";
import { streamSSE } from "../llm/client.js";
import { searchWeb } from "../search/webSearch.js";

const router = Router();
const Y = new Date().getFullYear();

// ─── 非流式（兼容旧版） ───

router.post("/operations/rules", async (req, res) => {
  try {
    const result = await monitorRules(req.body.platform || "", req.body.api_key || "");
    res.json({ ok: true, ...result });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.post("/operations/pick", async (req, res) => {
  try {
    const result = await recommendProduct({ budget: req.body.budget, platform: req.body.platform, category: req.body.category }, req.body.api_key || "");
    res.json({ ok: true, ...result });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.post("/operations/content", async (req, res) => {
  try {
    const result = await generateContent({ product: req.body.product, platform: req.body.platform, audience: req.body.audience, priceRange: req.body.priceRange }, req.body.api_key || "");
    res.json({ ok: true, ...result });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.post("/operations/service", async (req, res) => {
  try {
    const result = await getServiceReply(req.body.scene || "", req.body.context || "", req.body.api_key || "");
    res.json({ ok: true, ...result });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.post("/operations/pricing", async (req, res) => {
  try {
    const result = await getPricingAdvice({ product: req.body.product, cost: req.body.cost, platform: req.body.platform, competitors: req.body.competitors }, req.body.api_key || "");
    res.json({ ok: true, ...result });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// ─── SSE 流式端点（先搜索实时信息，再流式生成） ───

async function multiSearch(queries) {
  let result = "";
  for (const q of queries) {
    const r = await searchWeb(q);
    if (r) result += r + "\n\n";
  }
  return result;
}

// 规则变动（流式 + 搜索）
router.post("/operations/rules-stream", async (req, res) => {
  try {
    const platform = req.body.platform || "";
    const searchResult = await multiSearch([
      `${platform || "电商"} 平台规则 最新变动 ${Y}`,
      `${platform || "淘宝 抖音 拼多多"} 新规 处罚 费率 ${Y}`,
    ]);
    const platformHint = platform ? `重点关注平台：${platform}` : "关注所有主流平台（淘宝、京东、拼多多、抖音电商）";
    const userPrompt = [
      `请分析当前各电商平台的最新规则变动和应对策略。${platformHint}。`,
      searchResult ? `以下是实时搜索数据供参考：\n\n${searchResult}` : "请基于你最新的知识给出分析。",
    ].join("\n");
    await streamSSE(RULES_PROMPT, userPrompt, req.body.api_key || "", res);
  } catch (e) { if (!res.headersSent) res.status(500).json({ ok: false, error: e.message }); }
});

// 选品推荐（流式 + 搜索）
router.post("/operations/pick-stream", async (req, res) => {
  try {
    const { budget = "1-5万", platform = "抖音", category = "" } = req.body;
    const m = new Date().getMonth() + 1;
    const searchResult = await multiSearch([
      `${platform} ${m}月 热销商品 爆款 ${category} ${Y}`,
      `${budget} 预算 电商 选品 ${Y}`,
    ]);
    const userPrompt = [
      `当前时间：${Y}年${m}月`,
      `可用预算：${budget}`,
      `目标平台：${platform}`,
      category ? `偏好品类：${category}` : "无特定品类偏好，请广泛推荐",
      searchResult ? `以下是实时搜索数据供参考：\n\n${searchResult}` : "",
      `请根据以上条件，给出最适合的选品方向和具体运营建议。`,
    ].filter(Boolean).join("\n");
    await streamSSE(PICK_PROMPT, userPrompt, req.body.api_key || "", res);
  } catch (e) { if (!res.headersSent) res.status(500).json({ ok: false, error: e.message }); }
});

// 内容生成（流式 + 搜索热点内容趋势）
router.post("/operations/content-stream", async (req, res) => {
  const { product, platform = "抖音", audience = "", priceRange = "" } = req.body;
  if (!product || !product.trim()) {
    return res.status(400).json({ ok: false, error: "请填写商品信息" });
  }
  try {
    const searchResult = await multiSearch([
      `${platform} 爆款 短视频 脚本 ${product} ${Y}`,
      `${platform} 热门话题 内容 趋势 ${Y}`,
    ]);
    const userPrompt = [
      `商品：${product}`,
      `目标平台：${platform}`,
      audience ? `目标人群：${audience}` : "",
      priceRange ? `价格区间：${priceRange}` : "",
      searchResult ? `以下是实时热门内容趋势供参考：\n\n${searchResult}` : "",
      `请为我生成完整的营销内容方案，要求口语化、有爆款潜质，直接可用。`,
    ].filter(Boolean).join("\n");
    await streamSSE(CONTENT_PROMPT, userPrompt, req.body.api_key || "", res);
  } catch (e) { if (!res.headersSent) res.status(500).json({ ok: false, error: e.message }); }
});

// 客服话术（流式）
router.post("/operations/service-stream", async (req, res) => {
  const { scene, context = "" } = req.body;
  if (!scene || !scene.trim()) {
    return res.status(400).json({ ok: false, error: "请选择客服场景" });
  }
  try {
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
    await streamSSE(SERVICE_PROMPT, userPrompt, req.body.api_key || "", res);
  } catch (e) { if (!res.headersSent) res.status(500).json({ ok: false, error: e.message }); }
});

// 定价策略（流式 + 搜索竞品价格）
router.post("/operations/pricing-stream", async (req, res) => {
  const { product, cost = "", platform = "", competitors = "" } = req.body;
  if (!product || !product.trim()) {
    return res.status(400).json({ ok: false, error: "请填写商品信息和成本" });
  }
  try {
    const searchResult = await multiSearch([
      `${product} 价格 ${platform} 多少钱 ${Y}`,
      `${product} 竞品 价格 对比`,
    ]);
    const userPrompt = [
      `商品：${product}`,
      cost ? `成本（含运费）：${cost}` : "成本未知，请根据市场行情估算",
      platform ? `目标平台：${platform}` : "",
      competitors ? `竞品参考价：${competitors}` : "",
      searchResult ? `以下是实时搜索的竞品价格数据供参考：\n\n${searchResult}` : "",
      `请给出完整的定价策略和促销规划。`,
    ].filter(Boolean).join("\n");
    await streamSSE(PRICING_PROMPT, userPrompt, req.body.api_key || "", res);
  } catch (e) { if (!res.headersSent) res.status(500).json({ ok: false, error: e.message }); }
});

export default router;
