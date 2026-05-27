import { deepseekStream } from "../llm/client.js";
import { searchWeb } from "../search/webSearch.js";

const COMPETITOR_PROMPT = `你是电商竞争情报分析专家。根据搜索数据，为用户分析竞争对手的情况。

请按以下格式输出（Markdown）：

## 👥 竞争对手概览
简要说明当前赛道的主要竞争格局

## 🏪 主要竞店分析
对3-5家主要竞争对手，分别分析：
- **店铺名称**：定位和特色
- **核心品类**：主营什么
- **价格策略**：低价走量 / 中端品质 / 高端溢价
- **营销打法**：内容种草 / 直播带货 / 搜索卡位 / 私域运营
- **优势 & 弱点**：各列出1-2条

## 📊 价格带分布
分析当前品类各价格带的竞争密度（低/中/高/超高）

## 🎯 差异化机会
指出2-3个竞争对手覆盖不足的机会点

## ⚠️ 风险提示
当前入场或加大投入需要注意的风险`;

async function analyzeCompetitors(productCategory = "", apiKey = "") {
  const query = productCategory
    ? `${productCategory} 电商 热门店铺 竞品分析 2025 2026`
    : "电商 热门品类 头部店铺 竞品 2025 2026";
  const searchResult = await searchWeb(query);

  const messages = [
    { role: "system", content: COMPETITOR_PROMPT },
    {
      role: "user",
      content: searchResult
        ? `请基于以下实时搜索数据，分析竞争对手情况：\n\n品类：${productCategory || "综合"}\n\n${searchResult}`
        : `请分析${productCategory || "综合电商"}赛道的竞争对手情况`,
    },
  ];

  let fullText = "";
  for await (const chunk of deepseekStream(messages, apiKey)) {
    if (chunk.content) fullText += chunk.content;
  }
  return { content: fullText, searchResult, generatedAt: new Date().toISOString() };
}

export { analyzeCompetitors };
