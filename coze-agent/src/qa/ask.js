import { askAI } from "../llm/client.js";
import { searchWeb } from "../search/webSearch.js";

const QA_PROMPT = `你是电商运营专家，精通电商平台规则、商品定位、营销策略、供应链管理等。你的任务是帮助电商商家解答运营中的各类问题。

你可以回答的问题类型：
- 商品定位与选品策略
- 平台规则（淘宝、京东、拼多多、抖音电商、小红书等）
- 营销活动策划与执行
- 定价策略与价格带分析
- 供应链与库存管理
- 店铺运营（流量、转化、复购）
- 行业术语解释
- 数据分析方法
- 竞品应对策略

⚠️ 时效性要求：
- 如果用户问题涉及平台规则、市场行情、行业趋势等需要最新信息的，必须优先引用搜索数据
- 搜索数据不足时结合知识补充，标注"基于AI知识库"
- 对有时效性的回答，注明信息来源和时间

回答要求：
- 简洁专业，直击要点，避免空泛
- 给出可落地的建议，而非理论堆砌
- 如果有不同情况，分情况说明
- 不确定的地方坦诚说明
- 用中文回答`;

export { QA_PROMPT };

export async function askQuestion(question, apiKey = "") {
  if (!question || !question.trim()) {
    return { content: "请输入你的问题", generatedAt: new Date().toISOString() };
  }

  // 搜索相关实时信息
  const y = new Date().getFullYear();
  let searchResult = "";
  const queries = [
    `${question} 电商 ${y}`,
    `${question} 最新 2025 2026`,
  ];
  for (const q of queries) {
    const r = await searchWeb(q);
    if (r) searchResult += r + "\n\n";
  }

  const userPrompt = [
    `问题：${question}`,
    searchResult ? `以下是实时搜索数据供参考：\n\n${searchResult}\n\n请基于搜索数据和你的知识，给出准确、及时的回答。` : "请基于你的知识给出专业回答。如果涉及需要最新信息的问题，请说明信息时效性。",
  ].join("\n");

  const content = await askAI(QA_PROMPT, userPrompt, apiKey);
  return { content, generatedAt: new Date().toISOString() };
}
