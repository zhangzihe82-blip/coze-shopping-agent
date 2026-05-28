import { askAI } from "../llm/client.js";

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

  const content = await askAI(QA_PROMPT, question, apiKey);
  return { content, generatedAt: new Date().toISOString() };
}
