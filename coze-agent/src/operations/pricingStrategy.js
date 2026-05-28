import { deepseekStream } from "../llm/client.js";

const PROMPT = `你是电商定价策略专家，精通成本核算、竞品比价、促销定价、价格心理学和多平台差异化定价。

你的任务：根据商家提供的商品成本和市场信息，给出科学的定价策略。

输出格式（Markdown）：

## 💰 定价方案推荐
| 方案 | 售价 | 利润率 | 适用场景 | 预期销量 |
|------|------|--------|---------|---------|
（给出3-4个不同定位的定价方案）

## 📊 竞品价格带分析
- 市场上同类商品的价格分布
- 你的商品在哪个价格段最有竞争力

## 🎯 定价策略详解
- 日常价 vs 活动价 vs 清仓价
- 是否适合「高开低走」或「低价冲量」
- SKU 组合定价建议

## 🛒 促销节奏规划
- 什么时候降价、降多少
- 如何「涨价不掉量」
- 大促期间的定价策略

## ⚠️ 避雷提醒
- 该品类最容易被平台判定为「价格违规」的操作`;

export async function getPricingAdvice(params = {}, apiKey = "") {
  const { product = "", cost = "", platform = "", competitors = "" } = params;

  if (!product.trim()) {
    return { content: "请填写商品信息和成本，如：蓝牙耳机、成本35元...", generatedAt: new Date().toISOString() };
  }

  const userPrompt = [
    `商品：${product}`,
    cost ? `成本（含运费）：${cost}` : "成本未知，请根据市场行情估算",
    platform ? `目标平台：${platform}` : "",
    competitors ? `竞品参考价：${competitors}` : "",
    `请给出完整的定价策略和促销规划。`,
  ].filter(Boolean).join("\n");

  const messages = [
    { role: "system", content: PROMPT },
    { role: "user", content: userPrompt },
  ];

  let fullText = "";
  for await (const chunk of deepseekStream(messages, apiKey)) {
    if (chunk.content) fullText += chunk.content;
  }
  return { content: fullText, params, generatedAt: new Date().toISOString() };
}
