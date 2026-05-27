import { SearchClient, Config, HeaderUtils } from "coze-coding-dev-sdk";

async function searchWeb(query, reqHeaders = {}) {
  try {
    const customHeaders = HeaderUtils.extractForwardHeaders(reqHeaders);
    const config = new Config();
    const client = new SearchClient(config, customHeaders);
    const response = await client.webSearch(query, 8, true);

    if (response.web_items && response.web_items.length > 0) {
      const results = response.web_items
        .slice(0, 8)
        .map((item, i) => `${i + 1}. **${item.title}**\n   ${item.snippet}`)
        .join("\n\n");
      const summary = response.summary || "";
      return `## 🌐 实时搜索结果\n${summary ? "📋 搜索摘要：" + summary + "\n\n" : ""}### 相关链接\n${results}`;
    }
    return "";
  } catch (e) {
    console.error("Search error (搜索增强暂时不可用):", e.message);
    return "";
  }
}

function buildSearchQuery(intent, message) {
  const queries = {
    recommend: `${message} 推荐 评测 价格 2025 2026`,
    compare: `${message} 对比评测 参数 价格 2025 2026`,
    review: `${message} 用户评价 口碑 优缺点 2025 2026`,
    price: `${message} 价格 历史价格 性价比 2025 2026`,
    gift: `${message} 礼物推荐 送礼 2025 2026`,
  };
  return queries[intent] || queries.recommend;
}

function shouldSearch(intent) {
  return ["recommend", "compare", "review", "price", "gift"].includes(intent);
}

export { searchWeb, buildSearchQuery, shouldSearch };
