import { askAI } from "../llm/client.js";
import { searchWeb } from "../search/webSearch.js";

const NEWS_PROMPT = `你是电商行业新闻编辑。将搜索到的电商平台最新动态整理成结构化JSON新闻简报。

核心要求：
- 每条新闻必须标注：发生时间、所属平台、事件类别、来源链接
- 类别从以下选择：规则变动、价格调整、营销活动、流量政策、产品上新、行业事件、处罚警示、其他
- 只收录最近7天内的新闻
- url字段：优先使用搜索数据中的真实链接，无法获取则留空字符串
- 搜索数据不足时标注"基于AI知识库"

请以JSON数组格式输出（纯JSON，不要任何标记）：

[
  {
    "title": "新闻标题（简洁）",
    "platform": "平台名（抖音/淘宝/京东/拼多多/小红书/综合）",
    "category": "类别",
    "time": "YYYY-MM-DD",
    "summary": "一句话概述（40字以内）",
    "impact": "对商家的影响（25字以内）",
    "url": "来源链接或空字符串"
  }
]

最多15条，按时间倒序。必须是合法JSON。`;

export async function getNewsFeed(apiKey = "") {
  const y = new Date().getFullYear();
  const today = new Date().toISOString().slice(0, 10);

  const queries = [
    `电商平台 最新规则 变动 ${y}年 ${today}`,
    `抖音 淘宝 拼多多 京东 最新政策 更新 ${y}`,
    `电商 重大事件 行业动态 本周 ${y}`,
  ];

  let searchResult = "";
  for (const q of queries) {
    const r = await searchWeb(q);
    if (r) searchResult += r + "\n\n";
  }

  const userPrompt = [
    `今天是 ${today}`,
    `请整理最近7天内各电商平台的重要新闻和规则变动。`,
    searchResult ? `以下是实时搜索数据（请从中提取真实URL）：\n\n${searchResult}` : "请基于你最新的知识整理。",
    `\n请以JSON数组格式输出，按时间倒序，最多15条。每条必须包含title、platform、category、time、summary、impact、url字段。url从搜索数据中提取，没有则留空。`,
  ].join("\n");

  const raw = await askAI(NEWS_PROMPT, userPrompt, apiKey);

  try {
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const items = JSON.parse(jsonMatch[0]);
      return { items: items.slice(0, 15), generatedAt: new Date().toISOString() };
    }
  } catch (e) {
    console.error("News feed JSON parse error:", e.message);
  }

  return { items: [], generatedAt: new Date().toISOString(), error: "新闻解析失败，请稍后重试" };
}
