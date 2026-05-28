import https from "https";
import http from "http";

// Bing 搜索 — 无需 API Key，中国大陆可用
async function bingSearch(query) {
  const q = encodeURIComponent(query);
  const url = `https://www.bing.com/search?q=${q}&setlang=zh-cn&count=10`;

  return new Promise((resolve, reject) => {
    const get = url.startsWith("https") ? https.get : http.get;
    const req = get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "zh-CN,zh;q=0.9",
      },
    }, (res) => {
      // Bing 可能返回 302 重定向，跟随
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redirectUrl = res.headers.location.startsWith("http")
          ? res.headers.location
          : `https://www.bing.com${res.headers.location}`;
        bingSearchFetch(redirectUrl).then(resolve).catch(reject);
        return;
      }
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => resolve(parseBingResults(body)));
    });
    req.on("error", (e) => reject(e));
    req.setTimeout(8000, () => { req.destroy(); reject(new Error("Bing 搜索超时")); });
  });
}

function bingSearchFetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    }, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => resolve(parseBingResults(body)));
    }).on("error", (e) => reject(e));
  });
}

function parseBingResults(html) {
  const results = [];
  // 匹配 Bing 搜索结果块: <li class="b_algo"> ... </li>
  const blocks = html.split(/<li[^>]*class="b_algo"[^>]*>/gi).slice(1);
  for (const block of blocks) {
    const endIdx = block.indexOf("</li>");
    const content = endIdx > 0 ? block.substring(0, endIdx) : block;

    // 提取 URL
    const urlMatch = content.match(/<a[^>]*href="(https?:\/\/[^"]*)"[^>]*>/i)
                  || content.match(/href="(https?:\/\/[^"]*)"/i);
    // 提取标题 (去掉 HTML 标签)
    const titleMatch = content.match(/<a[^>]*href="[^"]*"[^>]*>([\s\S]*?)<\/a>/i);
    // 提取摘要
    const snippetMatch = content.match(/<p[^>]*>([\s\S]*?)<\/p>/i)
                      || content.match(/<div[^>]*class="[^"]*b_caption[^"]*"[^>]*>([\s\S]*?)<\/div>/i);

    const url = urlMatch ? urlMatch[1].replace(/&amp;/g, "&") : "";
    const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim() : "";
    const snippet = snippetMatch ? snippetMatch[1].replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim() : "";

    if (title && url && url.startsWith("http")) {
      results.push({ title, snippet: snippet.substring(0, 200), url });
    }
    if (results.length >= 8) break;
  }
  return results;
}

async function searchWeb(query, _reqHeaders = {}) {
  // 先尝试 Coze SDK（如果配置了）
  try {
    const { SearchClient, Config, HeaderUtils } = await import("coze-coding-dev-sdk");
    const customHeaders = HeaderUtils.extractForwardHeaders(_reqHeaders);
    const config = new Config();
    if (config.apiKey && config.baseUrl) {
      const client = new SearchClient(config, customHeaders);
      const response = await Promise.race([
        client.webSearch(query, 8, true),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Coze 搜索超时")), 3000)),
      ]);
      if (response.web_items && response.web_items.length > 0) {
        const results = response.web_items
          .slice(0, 8)
          .map((item, i) => `${i + 1}. **${item.title}**\n   ${item.snippet}\n   🔗 ${item.url || ""}`)
          .join("\n\n");
        const summary = response.summary || "";
        return `## 实时搜索结果\n${summary ? "搜索摘要：" + summary + "\n\n" : ""}### 相关链接\n${results}`;
      }
    }
  } catch (e) {
    // Coze SDK 不可用，降级到 Bing
  }

  // 降级：Bing 搜索
  try {
    const items = await Promise.race([
      bingSearch(query),
      new Promise((_, reject) => setTimeout(() => reject(new Error("搜索超时")), 5000)),
    ]);

    if (items.length > 0) {
      const results = items
        .slice(0, 8)
        .map((item, i) => `${i + 1}. **${item.title}**\n   ${item.snippet}\n   🔗 ${item.url}`)
        .join("\n\n");
      return `## 实时搜索结果\n### 相关链接\n${results}`;
    }
    return "";
  } catch (e) {
    console.error("Search error:", e.message);
    return "";
  }
}

function buildSearchQuery(intent, message) {
  const queries = {
    recommend: `${message} 推荐 评测 价格`,
    compare: `${message} 对比评测 参数 价格`,
    review: `${message} 用户评价 口碑 优缺点`,
    price: `${message} 价格 历史价格 性价比`,
    gift: `${message} 礼物推荐 送礼`,
  };
  return queries[intent] || queries.recommend;
}

function shouldSearch(intent) {
  return ["recommend", "compare", "review", "price", "gift"].includes(intent);
}

export { searchWeb, buildSearchQuery, shouldSearch };
