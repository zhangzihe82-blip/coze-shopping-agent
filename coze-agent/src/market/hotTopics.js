import { deepseekStream } from "../llm/client.js";
import { searchWeb } from "../search/webSearch.js";

const HOTTOPICS_PROMPT = `你是电商市场分析专家。根据搜索数据和你的知识，为用户整理当前市场的热点趋势。

请按以下格式输出（Markdown）：

## 🔥 今日市场热点概览
简要总结2-3句话概括当前市场风向

## 📈 热门品类 Top 5
| 排名 | 品类 | 热度趋势 | 关键驱动因素 |
|------|------|----------|-------------|

## 🏷️ 热搜关键词
列出10个当前搜索量上升的关键词，标注热度（🔥高/🟡中/🟢新）

## 📊 消费趋势洞察
3-4条有价值的消费趋势发现

## 💡 运营建议
基于热点给出2-3条可执行的选品/营销建议`;

async function getHotTopics(apiKey = "", category = "") {
  const query = category
    ? `${category} 电商 市场热点 趋势 2025 2026`
    : "电商 市场热点 消费趋势 热门品类 2025 2026";
  const searchResult = await searchWeb(query);

  const messages = [
    { role: "system", content: HOTTOPICS_PROMPT },
    {
      role: "user",
      content: searchResult
        ? `请基于以下实时搜索数据，分析当前市场热点：\n\n${searchResult}`
        : "请基于你的知识分析当前电商市场热点趋势",
    },
  ];

  let fullText = "";
  for await (const chunk of deepseekStream(messages, apiKey)) {
    if (chunk.content) fullText += chunk.content;
  }
  return { content: fullText, searchResult, generatedAt: new Date().toISOString() };
}

export { getHotTopics };
