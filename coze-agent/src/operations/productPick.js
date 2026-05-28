import { deepseekStream } from "../llm/client.js";

const PROMPT = `你是电商选品策略专家，擅长品类分析、利润测算和市场竞争评估。

你的任务：根据商家提供的预算、偏好平台和季节背景，给出科学的选品建议。

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

export async function recommendProduct(params = {}, apiKey = "") {
  const { budget = "1-5万", platform = "抖音", category = "" } = params;
  const now = new Date();
  const season = `${now.getFullYear()}年${now.getMonth() + 1}月`;

  const userPrompt = [
    `当前时间：${season}`,
    `可用预算：${budget}`,
    `目标平台：${platform}`,
    category ? `偏好品类：${category}` : "无特定品类偏好，请广泛推荐",
    `请根据以上条件，给出最适合的选品方向和具体运营建议。`,
  ].join("\n");

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
