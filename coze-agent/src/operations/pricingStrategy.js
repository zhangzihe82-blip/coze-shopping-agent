import { askAI } from "../llm/client.js";
import { searchWeb } from "../search/webSearch.js";

const PROMPT = `你是电商定价策略专家，精通成本核算、竞品比价、促销定价、价格心理学和多平台差异化定价。

你的任务：基于实时搜索数据，给出科学的定价策略。

⚠️ 时效性要求：
- 优先引用搜索数据中的竞品实际售价
- 考虑当前季节和大促节奏
- 标注数据来源

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

async function searchForPricing(params = {}) {
  const { product = "", platform = "" } = params;
  const y = new Date().getFullYear();
  const queries = [
    `${product} 价格 ${platform} 多少钱 ${y}`,
    `${product} 竞品 价格 对比 ${y}`,
    `${platform} ${product} 定价 策略 利润`,
  ].filter(q => q.trim());
  let result = "";
  for (const q of queries) {
    const r = await searchWeb(q);
    if (r) result += r + "\n\n";
  }
  return result;
}

export { PROMPT as PRICING_PROMPT };

export async function getPricingAdvice(params = {}, apiKey = "") {
  const { product = "", cost = "", platform = "", competitors = "" } = params;

  if (!product.trim()) {
    return { content: "请填写商品信息和成本，如：蓝牙耳机、成本35元...", generatedAt: new Date().toISOString() };
  }

  const searchResult = await searchForPricing(params);

  const userPrompt = [
    `商品：${product}`,
    cost ? `成本（含运费）：${cost}` : "成本未知，请根据市场行情估算",
    platform ? `目标平台：${platform}` : "",
    competitors ? `竞品参考价：${competitors}` : "",
    searchResult ? `以下是实时搜索数据供参考：\n\n${searchResult}` : "",
    `请给出完整的定价策略和促销规划。`,
  ].filter(Boolean).join("\n");

  const content = await askAI(PROMPT, userPrompt, apiKey);
  return { content, params, generatedAt: new Date().toISOString() };
}
