import { askAI } from "../llm/client.js";
import { searchWeb } from "../search/webSearch.js";

const PROMPT = `你是电商选品策略专家，擅长品类分析、利润测算和市场竞争评估。

你的任务：基于实时搜索数据，根据商家条件给出科学的选品建议。

⚠️ 时效性要求：
- 优先引用搜索数据中的最新市场信息
- 推荐的品类必须是当前季节正在热销或有上升趋势的
- 标注数据来源（搜索数据 vs AI知识库）

输出格式（Markdown）：

## 🎯 选品推荐（按推荐度排序）
| 推荐排名 | 品类/单品 | 预估利润率 | 竞争程度 | 推荐理由 |
|----------|----------|-----------|---------|---------|
（给出5-6个方向）

## 📊 品类对比分析
- 各推荐方向的优劣势
- 市场饱和度评估
- 季节性因素考量

## 💰 投入产出测算
- 建议首批进货量
- 预估启动资金分配
- 回本周期预估

## 🚀 冷启动建议
- 第一周运营重点
- 初期流量获取方式
- 避坑提醒`;

async function searchForProducts(params = {}) {
  const { budget = "", platform = "抖音", category = "" } = params;
  const y = new Date().getFullYear();
  const m = new Date().getMonth() + 1;
  const queries = [
    `${platform} ${m}月 热销商品 爆款 ${category} ${y}`,
    `${budget} 预算 电商 选品 推荐 ${y}`,
    `${platform} 新手 选品 趋势 ${y}年`,
  ].filter(q => q.trim());
  let result = "";
  for (const q of queries) {
    const r = await searchWeb(q);
    if (r) result += r + "\n\n";
  }
  return result;
}

export { PROMPT as PICK_PROMPT };

export async function recommendProduct(params = {}, apiKey = "") {
  const { budget = "1-5万", platform = "抖音", category = "" } = params;
  const now = new Date();
  const season = `${now.getFullYear()}年${now.getMonth() + 1}月`;

  const searchResult = await searchForProducts(params);

  const userPrompt = [
    `当前时间：${season}`,
    `可用预算：${budget}`,
    `目标平台：${platform}`,
    category ? `偏好品类：${category}` : "无特定品类偏好，请广泛推荐",
    searchResult ? `以下是实时搜索数据供参考：\n\n${searchResult}` : "",
    `请根据以上条件，给出最适合的选品方向和具体运营建议。`,
  ].filter(Boolean).join("\n");

  const content = await askAI(PROMPT, userPrompt, apiKey);
  return { content, params, generatedAt: new Date().toISOString() };
}
