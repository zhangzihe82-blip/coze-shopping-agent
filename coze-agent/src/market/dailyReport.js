import { askAI } from "../llm/client.js";
import { searchWeb } from "../search/webSearch.js";
import { getPublishHistory } from "../xhs/publisher.js";

const REPORT_PROMPT = `你是电商运营总监。根据提供的数据，生成一份专业的店铺每日运营总结报告。

请按以下格式输出（Markdown）：

## 📋 今日运营总结
### 核心数据
- 当日发布内容数、互动趋势、重点商品表现

### 亮点成就
2-3个值得关注的正面数据或事件

### 待改进
1-2个需要关注的问题点

## 📈 明日计划建议
2-3条具体的次日运营动作建议

## 🎯 周度趋势
结合近期数据，指出值得关注的趋势变化

风格：专业、数据驱动、可执行，避免空泛的套话`;

async function generateDailyReport(apiKey = "", customNotes = "") {
  // 收集当日数据
  const publishHistory = getPublishHistory();
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayPublishes = publishHistory.filter((h) => h.createdAt.startsWith(todayStr));

  // 搜索当日市场动态
  const searchResult = await searchWeb("电商 今日热点 消费趋势 市场动态 2025 2026");

  // 构建数据摘要
  const dataSummary = [
    `## 今日发布数据`,
    `- 发布笔记数：${todayPublishes.length} 条`,
    `- 涉及商品：${todayPublishes.map((p) => p.title).join("、") || "无"}`,
    customNotes ? `\n## 运营备注\n${customNotes}` : "",
  ].join("\n");

  const userPrompt = [
    `请基于以下数据生成今日店铺运营总结：`,
    dataSummary,
    searchResult ? `\n## 今日市场动态\n${searchResult}` : "",
  ].join("\n");
  const content = await askAI(REPORT_PROMPT, userPrompt, apiKey);
  return {
    content,
    dataSource: {
      todayPublishes: todayPublishes.length,
      date: todayStr,
    },
    generatedAt: new Date().toISOString(),
  };
}

export { generateDailyReport };
