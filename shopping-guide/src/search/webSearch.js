import https from "https";
import http from "http";

// ─── Bing Web Search ───
async function bingSearch(query) {
  const q = encodeURIComponent(query);
  const url = `https://cn.bing.com/search?q=${q}&setlang=zh-cn&count=10`;

  return new Promise((resolve, reject) => {
    const get = url.startsWith("https") ? https.get : http.get;
    const req = get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "zh-CN,zh;q=0.9",
      },
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redirectUrl = res.headers.location.startsWith("http")
          ? res.headers.location
          : `https://cn.bing.com${res.headers.location}`;
        fetchUrl(redirectUrl).then(resolve).catch(reject);
        return;
      }
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => resolve(parseBingResults(body)));
    });
    req.on("error", (e) => reject(e));
    req.setTimeout(8000, () => { req.destroy(); reject(new Error("Bing search timeout")); });
  });
}

function fetchUrl(url) {
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
  const blocks = html.split(/<li[^>]*class="b_algo"[^>]*>/gi).slice(1);
  for (const block of blocks) {
    const endIdx = block.indexOf("</li>");
    const content = endIdx > 0 ? block.substring(0, endIdx) : block;

    const urlMatch = content.match(/<a[^>]*href="(https?:\/\/[^"]*)"[^>]*>/i)
                  || content.match(/href="(https?:\/\/[^"]*)"/i);
    const titleMatch = content.match(/<a[^>]*href="[^"]*"[^>]*>([\s\S]*?)<\/a>/i);
    const snippetMatch = content.match(/<p[^>]*>([\s\S]*?)<\/p>/i)
                      || content.match(/<div[^>]*class="[^"]*b_caption[^"]*"[^>]*>([\s\S]*?)<\/div>/i);

    const url = urlMatch ? urlMatch[1].replace(/&amp;/g, "&") : "";
    // Clean title: strip all HTML tags and HTML entities
    let title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#\d+;/g, "").trim() : "";
    // Remove domain prefix + URL prefix that Bing prepends (e.g., "baidu.comhttps://baike.baidu.com › ...")
    title = title.replace(/^[a-z0-9.-]+\.[a-z]{2,}https?:\/\/[^\s›>]*\s*[›>]\s*/i, "");
    // Remove bare domain prefix (e.g., "baidu.com › ...")
    title = title.replace(/^[a-z0-9.-]+\.[a-z]{2,}\s*[›>]\s*/i, "");
    title = title.trim();
    const snippet = snippetMatch ? snippetMatch[1].replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim() : "";

    if (title && url && url.startsWith("http")) {
      results.push({ title, snippet: snippet.substring(0, 200), url });
    }
    if (results.length >= 8) break;
  }
  return results;
}

// ─── Bing Image Search ───
async function bingImageSearch(query) {
  const q = encodeURIComponent(query + " 商品 主图");
  const url = `https://cn.bing.com/images/search?q=${q}&qft=+filterui:imagesize-medium&form=IRFLTR&first=1`;

  const fetchPage = (fetchUrl) => new Promise((resolve, reject) => {
    const get = fetchUrl.startsWith("https") ? https.get : http.get;
    const req = get(fetchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "zh-CN,zh;q=0.9",
      },
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redirectUrl = res.headers.location.startsWith("http")
          ? res.headers.location
          : `https://cn.bing.com${res.headers.location}`;
        fetchPage(redirectUrl).then(resolve).catch(reject);
        return;
      }
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => resolve(parseBingImages(body)));
    });
    req.on("error", (e) => reject(e));
    req.setTimeout(8000, () => { req.destroy(); reject(new Error("Image search timeout")); });
  });

  return fetchPage(url);
}

function parseBingImages(html) {
  const images = [];

  // Pattern 1: murl attribute in Bing's internal data (various encoding formats)
  const murlPatterns = [
    /murl&quot;:&quot;(https?:\\?\/\\?\/[^&]+)&quot;/gi,
    /murl":"(https?:\/\/[^"]+)"/gi,
    /murl=([^&\s"']+)/gi,
    /"murl"\s*:\s*"(https?:\/\/[^"]+)"/gi,
    /murl&quot;:&quot;(https?:[^&]+)&quot;/gi,
  ];

  for (const pattern of murlPatterns) {
    const matches = html.match(pattern) || [];
    for (const m of matches) {
      let url = m
        .replace(/murl&quot;:&quot;/, "")
        .replace(/"murl"\s*:\s*"/, "")
        .replace(/murl=/, "")
        .replace(/&quot;.*/, "")
        .replace(/".*/, "")
        .replace(/\\\//g, "/")
        .replace(/\\u002F/g, "/");
      if (url && url.startsWith("http") && !images.includes(url) && !url.includes("bing.com/th")) {
        images.push(url);
      }
      if (images.length >= 5) break;
    }
    if (images.length >= 5) break;
  }

  // Pattern 2: img tags with full-size image URLs
  if (images.length === 0) {
    const imgRegex = /<img[^>]*src="(https?:\\?\/\\?\/[^"]*)"[^>]*>/gi;
    const thumbMatches = html.match(imgRegex) || [];
    for (const m of thumbMatches) {
      const srcMatch = m.match(/src="(https?:\\?\/\\?\/[^"]*)"/i);
      if (srcMatch) {
        const url = srcMatch[1].replace(/\\\//g, "/");
        if (url && url.startsWith("http") && !url.includes("bing.com/th") && !images.includes(url)) {
          images.push(url);
        }
      }
      if (images.length >= 5) break;
    }
  }

  // Pattern 3: Look for any http image URLs in the page
  if (images.length === 0) {
    const anyImgUrls = html.match(/https?:\/\/[^"\s<>]+\.(?:jpg|jpeg|png|webp|gif)(?:\?[^"\s<>]*)?/gi) || [];
    for (const url of anyImgUrls) {
      if (!url.includes("bing.com") && !images.includes(url)) {
        images.push(url);
      }
      if (images.length >= 5) break;
    }
  }

  return images;
}

// ─── Main search function ───
async function searchWeb(query, _reqHeaders = {}) {
  // Try Bing web search
  try {
    const items = await Promise.race([
      bingSearch(query),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Search timeout")), 5000)),
    ]);

    if (items.length > 0) {
      const results = items.slice(0, 8).map((item, i) =>
        `${i + 1}. **${item.title}**\n   ${item.snippet}\n   🔗 ${item.url}`
      ).join("\n\n");
      return `## 实时搜索结果\n### 相关链接\n${results}`;
    }
  } catch (e) {
    console.error("Web search error:", e.message);
  }
  return "";
}

// ─── E-commerce product search (real purchase links) ───
async function searchEcommerce(query) {
  const allResults = [];

  // Search 1: Bing general search for reviews and recommendations (often contain real links)
  try {
    const items = await Promise.race([
      bingSearch(`${query} 购买 推荐 评测 价格`),
      new Promise((resolve) => setTimeout(() => resolve([]), 4000)),
    ]);
    for (const item of items) item.platform = "综合推荐";
    allResults.push(...items);
  } catch (e) {}

  // Search 2: Search specifically for JD product pages
  try {
    const items = await Promise.race([
      bingSearch(`${query} 京东`),
      new Promise((resolve) => setTimeout(() => resolve([]), 4000)),
    ]);
    for (const item of items) item.platform = "京东相关";
    allResults.push(...items);
  } catch (e) {}

  // Product URL patterns for known e-commerce platforms
  const productUrlPatterns = [
    /item\.jd\.com\/\d+/,
    /detail\.tmall\.com/,
    /item\.taobao\.com/,
    /mobile\.yangkeduo\.com/,
    /yangkeduo\.com\/goods/,
    /chaoshi\.detail\.tmall/,
    /\.vip\.com\//,
    /\.sunin\.com\//,
  ];

  // Filter and separate real e-commerce links from informational pages
  const ecomMatches = [];
  const otherResults = [];

  for (const item of allResults) {
    const isProductPage = productUrlPatterns.some((p) => p.test(item.url));
    if (isProductPage) {
      ecomMatches.push({ ...item, platform: "真实商品链接" });
    } else {
      otherResults.push(item);
    }
  }

  // Combine: e-commerce product pages first, then other results
  const combined = [...ecomMatches, ...otherResults];

  // Deduplicate
  const seen = new Set();
  const unique = [];
  for (const item of combined) {
    if (!seen.has(item.url) && item.url.startsWith("http")) {
      seen.add(item.url);
      unique.push(item);
    }
    if (unique.length >= 8) break;
  }

  // Always append platform search URLs as guaranteed-working links
  const encQuery = encodeURIComponent(query);
  const platformLinks = [
    { title: `${query} - 京东搜索结果`, url: `https://search.jd.com/Search?keyword=${encQuery}&enc=utf-8`, platform: "京东" },
    { title: `${query} - 天猫搜索结果`, url: `https://list.tmall.com/search_product.htm?q=${encQuery}`, platform: "天猫" },
    { title: `${query} - 淘宝搜索结果`, url: `https://s.taobao.com/search?q=${encQuery}`, platform: "淘宝" },
    { title: `${query} - 拼多多搜索结果`, url: `https://mobile.yangkeduo.com/search_result.html?search_key=${encQuery}`, platform: "拼多多" },
  ];

  for (const link of platformLinks) {
    if (!seen.has(link.url)) {
      seen.add(link.url);
      unique.push(link);
    }
  }

  return unique.slice(0, 12);
}

// ─── Product image search (for frontend use) ───
async function searchProductImages(query) {
  try {
    const images = await Promise.race([
      bingImageSearch(query),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Image search timeout")), 4000)),
    ]);
    return images;
  } catch (e) {
    console.error("Image search error:", e.message);
    return [];
  }
}

function buildSearchQuery(intent, message) {
  const queries = {
    recommend: `${message} 推荐 评测 价格 购买链接`,
    compare: `${message} 对比评测 参数 价格 购买链接`,
    review: `${message} 用户评价 口碑 优缺点`,
    price: `${message} 价格 各平台比价 购买`,
    gift: `${message} 礼物推荐 送礼 购买`,
  };
  return queries[intent] || queries.recommend;
}

function shouldSearch(intent) {
  return ["recommend", "compare", "review", "price", "gift"].includes(intent);
}

export { searchWeb, searchProductImages, searchEcommerce, buildSearchQuery, shouldSearch };
