import { deepseekStream } from "../llm/client.js";
import { searchWeb } from "../search/webSearch.js";

const TRENDS_PROMPT = `你是电商市场数据分析师。请基于搜索数据，给出一份当前市场上热销商品的真实情报。

要求：
1. 数据要具体——品类名、大致价格区间、热销原因
2. 区分不同平台（淘宝/京东/抖音/拼多多）的热销差异
3. 标注数据来源，无法确认的标注"趋势参考"
4. 口语化但有数据支撑，像给老板做口头汇报

按以下格式输出（Markdown）：

## 🔥 当前热销品类 Top 6
| 排名 | 品类 | 价格区间 | 热销平台 | 热销原因 |
|------|------|---------|---------|---------|

## 📈 近期上升趋势
2-3个正在快速上升的品类或单品，说明为什么在涨

## 🛒 分平台看点
- **抖音**：当前什么类型的商品卖得好
- **淘宝/天猫**：搜索量上升的品类
- **拼多多**：低价爆款方向
- **京东**：高客单价热门品类

## 💰 价格带热度分布
当前消费集中在哪个价格段？有没有消费升级/降级的信号？

## ⚡ 一句话总结
用一句话概括今天市场的核心特征`;

const POLICY_PROMPT = `你是电商政策与行业新闻分析师。根据用户搜索的关键词，整理相关的政府政策、法规动态和行业新闻。

要求：
1. 优先搜索和整理权威来源（政府网站、主流财经媒体）
2. 区分「政策法规」和「行业新闻」两类
3. 对每条信息标注来源和时间
4. 分析这些政策/新闻对电商卖家的实际影响
5. 如果搜索结果不足，诚实说明并给出建议的搜索方向

按以下格式输出：

## 📜 相关政策法规
逐条列出与关键词相关的政策、法规、监管动态：
- **政策名称/标题**：简述内容，对卖家的影响
- 标注来源和日期

## 📰 行业新闻动态
逐条列出相关的重要新闻：
- **新闻要点**：简述，对市场的影响
- 标注来源和日期

## ⚖️ 对卖家的影响分析
这些政策和新闻意味着什么？利好还是利空？应该怎么应对？

## 🔍 建议关注方向
基于以上信息，建议关注哪些后续动态`;

// 一键获取当前市场热销趋势
async function getMarketTrends(apiKey = "") {
  const query = "电商 热销商品 爆款 销量排行 趋势 2025 2026";
  const searchResult = await searchWeb(query);

  const messages = [
    { role: "system", content: TRENDS_PROMPT },
    {
      role: "user",
      content: searchResult
        ? `请基于以下实时搜索数据，分析当前市场上什么卖得好：\n\n${searchResult}`
        : "请基于你的知识分析当前电商市场热销趋势",
    },
  ];

  let fullText = "";
  for await (const chunk of deepseekStream(messages, apiKey)) {
    if (chunk.content) fullText += chunk.content;
  }
  return { content: fullText, generatedAt: new Date().toISOString() };
}

// 关键词搜索政策与新闻
async function searchPolicyNews(keyword = "", apiKey = "") {
  if (!keyword || !keyword.trim()) {
    return { content: "请输入要搜索的关键词", generatedAt: new Date().toISOString() };
  }

  const query = `${keyword} 政策 法规 政府 新闻 行业动态 2025 2026`;
  const searchResult = await searchWeb(query);

  const messages = [
    { role: "system", content: POLICY_PROMPT },
    {
      role: "user",
      content: searchResult
        ? `请基于以下实时搜索数据，分析"${keyword}"相关的政策和新闻：\n\n${searchResult}`
        : `请分析与"${keyword}"相关的政策法规和行业新闻`,
    },
  ];

  let fullText = "";
  for await (const chunk of deepseekStream(messages, apiKey)) {
    if (chunk.content) fullText += chunk.content;
  }
  return { content: fullText, keyword, generatedAt: new Date().toISOString() };
}

export { getMarketTrends, searchPolicyNews };
