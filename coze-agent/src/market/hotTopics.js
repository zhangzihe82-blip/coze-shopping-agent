import { askAI } from "../llm/client.js";
import { searchWeb } from "../search/webSearch.js";

function now() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return { dateStr: `${y}-${m}-${day}`, year: y, month: m, day };
}

const TRENDS_PROMPT = `你是电商市场数据分析师。现在是 {DATE}，请基于你的知识和搜索数据，给出当前市场上热销商品的真实情报。

⚠️ 时效性要求（非常重要）：
- 只报告 {YEAR} 年的数据，绝对不要使用 {YEAR_OLD} 年及以前的过时信息
- 如果搜索数据不够新鲜，直接根据你最新的知识补充，并标注"基于AI知识库"
- 要的是「此刻」正在发生的趋势，不是「历史上」的趋势
- 对于无法确认时效性的数据，不要引用

输出格式（Markdown）：

## 🔥 当前热销品类 Top 6
| 排名 | 品类 | 价格区间 | 热销平台 | 热销原因 |
|------|------|---------|---------|---------|
（必须基于 {YEAR} 年数据）

## 📈 近期上升趋势
2-3个 {MONTH} 月正在快速上升的品类或单品

## 🛒 分平台看点
- **抖音**：当前什么类型卖得好
- **淘宝/天猫**：搜索量上升品类
- **拼多多**：低价爆款方向
- **京东**：高客单价热门

## 💰 价格带热度
当前消费集中在哪个价格段？消费升级还是降级？

## ⚡ 一句话总结
今天 ({DATE}) 市场的核心特征`;

const POLICY_PROMPT = `你是电商政策与行业新闻分析师。现在是 {DATE}。

⚠️ 时效性要求：
- 优先整理 {YEAR} 年的最新政策和新闻
- 如果搜索数据不够新，坦诚说明并基于你的知识补充
- 对每条信息标注具体日期，无法确认日期的标注"时间待查"

输出格式：

## 📜 相关政策法规
- **政策名称/标题**：简述 + 对卖家影响 + 来源+日期

## 📰 行业新闻动态
- **新闻要点**：简述 + 市场影响 + 来源+日期

## ⚖️ 对卖家的影响分析
利好还是利空？怎么应对？

## 🔍 建议关注方向`;

function buildTrendsPrompt() {
  const { dateStr, year, month } = now();
  return TRENDS_PROMPT
    .replace(/\{DATE\}/g, dateStr)
    .replace(/\{YEAR\}/g, String(year))
    .replace(/\{YEAR_OLD\}/g, String(year - 1))
    .replace(/\{MONTH\}/g, String(month));
}

function buildPolicyPrompt() {
  const { dateStr, year } = now();
  return POLICY_PROMPT.replace(/\{DATE\}/g, dateStr).replace(/\{YEAR\}/g, String(year));
}

// 一键获取当前市场热销趋势
async function getMarketTrends(apiKey = "") {
  const { year } = now();
  // 多次搜索拼合更多实时数据
  const queries = [
    `${year}年 电商热销商品 爆款排行 最新`,
    `${year}年 抖音 淘宝 热卖品类 销量 趋势`,
    `电商 本周 热门商品 消费趋势 ${year}`,
  ];

  let searchResult = "";
  for (const q of queries) {
    const r = await searchWeb(q);
    if (r) searchResult += r + "\n\n";
  }

  const content = await askAI(buildTrendsPrompt(), [
    `当前日期：${now().dateStr}`,
    `请分析现在市场上什么卖得最好。要求只使用${year}年的数据。`,
    searchResult ? `以下是实时搜索数据供参考：\n\n${searchResult}` : "",
  ].join("\n"), apiKey);
  return { content, generatedAt: new Date().toISOString() };
}

// 关键词搜索政策与新闻
async function searchPolicyNews(keyword = "", apiKey = "") {
  if (!keyword || !keyword.trim()) {
    return { content: "请输入要搜索的关键词", generatedAt: new Date().toISOString() };
  }

  const { year } = now();
  const queries = [
    `${keyword} 最新政策 法规 ${year}`,
    `${keyword} 行业新闻 动态 ${year}`,
  ];

  let searchResult = "";
  for (const q of queries) {
    const r = await searchWeb(q);
    if (r) searchResult += r + "\n\n";
  }

  const content = await askAI(buildPolicyPrompt(), [
    `搜索关键词：${keyword}`,
    `当前日期：${now().dateStr}`,
    `请整理与"${keyword}"相关的最新政策和新闻。`,
    searchResult ? `实时搜索数据：\n\n${searchResult}` : "",
  ].join("\n"), apiKey);
  return { content, keyword, generatedAt: new Date().toISOString() };
}

export { getMarketTrends, searchPolicyNews };
