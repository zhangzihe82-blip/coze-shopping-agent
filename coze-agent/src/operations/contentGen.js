import { askAI } from "../llm/client.js";

const PROMPT = `你是电商内容营销专家，擅长短视频脚本、直播话术、小红书种草文案、商品详情页文案创作。

你的任务：根据商家提供的商品信息、目标平台和人群，生成可直接使用的爆款内容。

输出格式（Markdown）：

## 🎬 短视频脚本（3个方向）
每个方向包含：标题、前3秒钩子、分镜脚本、结尾 CTA

## 📺 直播话术
- 开场留人话术（30秒）
- 产品讲解框架（3分钟）
- 逼单转化话术
- 直播间互动话术

## 📕 小红书种草文案
- 2-3个不同角度的笔记文案
- 标题 + 正文 + 话题标签

## 🏷️ 商品详情页优化
- 标题优化建议
- 核心卖点提炼
- 痛点-解决方案文案结构`;

export { PROMPT as CONTENT_PROMPT };

export async function generateContent(params = {}, apiKey = "") {
  const { product = "", platform = "抖音", audience = "", priceRange = "" } = params;

  if (!product.trim()) {
    return { content: "请填写商品信息，如：39元保温杯、高端护肤品套装...", generatedAt: new Date().toISOString() };
  }

  const userPrompt = [
    `商品：${product}`,
    `目标平台：${platform}`,
    audience ? `目标人群：${audience}` : "",
    priceRange ? `价格区间：${priceRange}` : "",
    `请为我生成完整的营销内容方案，要求口语化、有爆款潜质，直接可用。`,
  ].filter(Boolean).join("\n");

  const content = await askAI(PROMPT, userPrompt, apiKey);
  return { content, params, generatedAt: new Date().toISOString() };
}
