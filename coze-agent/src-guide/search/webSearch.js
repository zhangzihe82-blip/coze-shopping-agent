import https from "https";
import http from "http";
import iconv from "iconv-lite";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const LANG = "zh-CN,zh;q=0.9";

// ─── HTTP helpers ───
function fetchHtml(url, timeout = 6000) {
  return new Promise((resolve, reject) => {
    const get = url.startsWith("https") ? https.get : http.get;
    const req = get(url, {
      headers: { "User-Agent": UA, "Accept-Language": LANG },
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const r = res.headers.location;
        const redirectUrl = r.startsWith("http") ? r : new URL(r, url).href;
        fetchHtml(redirectUrl, timeout - 1000).then(resolve).catch(reject);
        return;
      }
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const buf = Buffer.concat(chunks);
        // Auto-detect GBK and decode
        const ct = (res.headers["content-type"] || "").toLowerCase();
        if (ct.includes("gbk") || ct.includes("gb2312") || ct.includes("gb18030")) {
          resolve(iconv.decode(buf, "gbk"));
        } else {
          // Try UTF-8 first, fall back to GBK
          const utf8 = buf.toString("utf8");
          if (utf8.includes("�") && !utf8.includes("charset=utf") && !utf8.includes("charset=UTF")) {
            resolve(iconv.decode(buf, "gbk"));
          } else {
            resolve(utf8);
          }
        }
      });
    });
    req.on("error", (e) => reject(e));
    req.setTimeout(timeout, () => { req.destroy(); reject(new Error("Timeout")); });
  });
}

// ─── Bing Web Search ───
async function bingSearch(query) {
  const q = encodeURIComponent(query);
  const url = `https://cn.bing.com/search?q=${q}&setlang=zh-cn&count=10`;
  try {
    const html = await fetchHtml(url, 8000);
    return parseBingResults(html);
  } catch (e) {
    console.error("Bing search error:", e.message);
    return [];
  }
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
    let title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#\d+;/g, "").trim() : "";
    title = title.replace(/^[a-z0-9.-]+\.[a-z]{2,}https?:\/\/[^\s›>]*\s*[›>]\s*/i, "");
    title = title.replace(/^[a-z0-9.-]+\.[a-z]{2,}\s*[›>]\s*/i, "").trim();
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
  const q = encodeURIComponent(query + " 实拍图 商品");
  const url = `https://cn.bing.com/images/search?q=${q}&qft=+filterui:imagesize-medium&form=IRFLTR&first=1`;

  const fetchPage = (fetchUrl) => new Promise((resolve, reject) => {
    const get = fetchUrl.startsWith("https") ? https.get : http.get;
    const req = get(fetchUrl, {
      headers: { "User-Agent": UA, "Accept-Language": LANG },
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
      let url = m.replace(/murl&quot;:&quot;/, "").replace(/"murl"\s*:\s*"/, "").replace(/murl=/, "")
        .replace(/&quot;.*/, "").replace(/".*/, "").replace(/\\\//g, "/").replace(/\\u002F/g, "/");
      if (url && url.startsWith("http") && !images.includes(url) && !url.includes("bing.com/th")) {
        images.push(url);
      }
      if (images.length >= 5) break;
    }
    if (images.length >= 5) break;
  }

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

  if (images.length === 0) {
    const anyImgUrls = html.match(/https?:\/\/[^"\s<>]+\.(?:jpg|jpeg|png|webp)(?:\?[^"\s<>]*)?/gi) || [];
    for (const url of anyImgUrls) {
      if (!url.includes("bing.com") && !images.includes(url)) {
        images.push(url);
      }
      if (images.length >= 5) break;
    }
  }

  return images;
}

// ─── Product link extraction from any HTML page ───
const PRODUCT_URL_PATTERNS = [
  { regex: /https?:\/\/item\.jd\.com\/\d+\.html/gi, platform: "京东" },
  { regex: /https?:\/\/detail\.tmall\.com\/item\.htm[^"'\s<>]*/gi, platform: "天猫" },
  { regex: /https?:\/\/item\.taobao\.com\/item\.htm[^"'\s<>]*/gi, platform: "淘宝" },
  { regex: /https?:\/\/(?:mobile\.)?yangkeduo\.com\/goods[^"'\s<>]*/gi, platform: "拼多多" },
  { regex: /https?:\/\/chaoshi\.detail\.tmall\.com\/item\.htm[^"'\s<>]*/gi, platform: "天猫超市" },
  { regex: /https?:\/\/p\.yangkeduo\.com\/goods[^"'\s<>]*/gi, platform: "拼多多" },
];

function extractProductLinks(html) {
  const results = [];
  for (const { regex, platform } of PRODUCT_URL_PATTERNS) {
    const matches = html.match(regex) || [];
    for (const url of matches) {
      const clean = url.replace(/&amp;/g, "&").replace(/["'<>]/g, "").trim();
      if (clean.startsWith("http") && !results.find(r => r.url === clean)) {
        results.push({ url: clean, platform, title: `${platform}商品链接` });
      }
      if (results.length >= 10) break;
    }
    if (results.length >= 10) break;
  }
  return results;
}

// Extract product images from a product page or review page
function extractPageImages(html) {
  const images = [];
  // Look for og:image meta tags
  const ogMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i);
  if (ogMatch) images.push(ogMatch[1]);

  // Look for product images (common patterns on e-commerce sites)
  const imgPatterns = [
    /<img[^>]*src="(https?:\/\/img[^"]*360buyimg[^"]*)"[^>]*>/gi,
    /<img[^>]*src="(https?:\/\/[^"]*alicdn\.com[^"]*)"[^>]*>/gi,
    /<img[^>]*src="(https?:\/\/[^"]*yangkeduo[^"]*\.(?:jpg|png|webp)[^"]*)"[^>]*>/gi,
    /<img[^>]*data-src="(https?:\/\/[^"]+)"[^>]*>/gi,
  ];

  for (const pattern of imgPatterns) {
    const matches = html.match(pattern) || [];
    for (const m of matches) {
      const srcMatch = m.match(/(?:src|data-src)="([^"]+)"/i);
      if (srcMatch && !images.includes(srcMatch[1])) {
        images.push(srcMatch[1]);
      }
      if (images.length >= 8) break;
    }
    if (images.length >= 8) break;
  }

  // Fallback: any large-ish image
  if (images.length < 2) {
    const allImgs = html.match(/<img[^>]*src="(https?:\/\/[^"]+)"[^>]*>/gi) || [];
    for (const m of allImgs) {
      const srcMatch = m.match(/src="(https?:\/\/[^"]+)"/i);
      if (srcMatch) {
        const url = srcMatch[1];
        if (url.includes("img") || url.match(/\.(jpg|png|webp)(\?|$)/i)) {
          if (!images.includes(url) && !url.includes("logo") && !url.includes("icon") && !url.includes("avatar")) {
            images.push(url);
          }
        }
      }
      if (images.length >= 5) break;
    }
  }

  return images;
}

// ─── Main search function ───
async function searchWeb(query, _reqHeaders = {}) {
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

// ─── Dangdang product search ───
async function searchDangdang(query) {
  const products = [];
  try {
    const html = await Promise.race([
      fetchHtml(`https://search.dangdang.com/?key=${encodeURIComponent(query)}&act=input`, 8000),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 7000)),
    ]);

    // Each product is in an <li> with id=productID
    const blocks = html.split(/<li[^>]*ddt-pit=["'][^"']*["'][^>]*id=["'](\d+)["']/gi);
    // Alternative: extract by known pattern
    const productPattern = /<a[^>]*title="([^"]+)"[^>]*href="\/\/product\.dangdang\.com\/(\d+)\.html"[^>]*>/gi;
    const titles = [];
    const ids = [];
    let match;
    const seenIds = new Set();
    while ((match = productPattern.exec(html)) !== null) {
      const title = match[1].replace(/&#\d+;/g, "").replace(/<[^>]+>/g, "").trim();
      const id = match[2];
      if (!seenIds.has(id) && title.length > 2) {
        seenIds.add(id);
        titles.push({ title, id });
      }
    }

    // Extract prices
    const pricePattern = /<span[^>]*class="price_n"[^>]*>(?:&yen;|¥)([^<]+)<\/span>/gi;
    const prices = [];
    while ((match = pricePattern.exec(html)) !== null) {
      prices.push(match[1].trim());
    }

    // Extract original prices
    const origPricePattern = /<span[^>]*class="price_r"[^>]*>(?:&yen;|¥)([^<]+)<\/span>/gi;
    const origPrices = [];
    while ((match = origPricePattern.exec(html)) !== null) {
      origPrices.push(match[1].trim());
    }

    // Extract product images (ddimg.cn with product ID in path, or img3mX pattern)
    const images = [];
    const prodImgPattern = /<img[^>]*src=['"](\/\/img3m\d\.ddimg\.cn\/\d+\/\d+\/\d+-1_[^'"]*(?:jpg|png|jpeg))['"]/gi;
    while ((match = prodImgPattern.exec(html)) !== null) {
      const src = "https:" + match[1];
      if (!images.includes(src)) images.push(src);
    }
    // Fallback: any ddimg.cn image with product ID pattern
    if (images.length === 0) {
      const fallbackImg = /<img[^>]*src=['"](\/\/img[^'"]*ddimg[^'"]*\d{8,}[^'"]*(?:jpg|png|jpeg))['"]/gi;
      while ((match = fallbackImg.exec(html)) !== null) {
        const src = "https:" + match[1];
        if (!images.includes(src) && !src.includes("erweima") && !src.includes("brand_") && !src.includes("icon")) {
          images.push(src);
        }
      }
    }

    // Combine data
    for (let i = 0; i < Math.min(titles.length, 6); i++) {
      const { title, id } = titles[i];
      products.push({
        title: title.substring(0, 80),
        url: `https://product.dangdang.com/${id}.html`,
        platform: "当当",
        price: prices[i] ? `¥${prices[i]}` : (origPrices[i] ? `¥${origPrices[i]}` : "查看详情"),
        image: images[i] || "",
      });
    }

    return { products, images };
  } catch (e) {
    console.error("Dangdang search error:", e.message);
    return { products: [], images: [] };
  }
}

// ─── Suning product search ───
async function searchSuning(query) {
  const products = [];
  const images = [];
  try {
    const html = await Promise.race([
      fetchHtml(`https://search.suning.com/${encodeURIComponent(query)}/`, 8000),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 7000)),
    ]);

    // Suning product links
    const linkPattern = /https?:\/\/product\.suning\.com\/\d+\.html/gi;
    const seenUrls = new Set();
    const urls = [];
    let match;
    while ((match = linkPattern.exec(html)) !== null) {
      const url = match[0];
      if (!seenUrls.has(url)) {
        seenUrls.add(url);
        urls.push(url);
      }
    }

    // Titles
    const titlePattern = /<a[^>]*href="[^"]*product\.suning\.com[^"]*"[^>]*title="([^"]+)"[^>]*>/gi;
    const titles = [];
    while ((match = titlePattern.exec(html)) !== null) {
      titles.push(match[1].trim());
    }

    // Prices
    const pricePattern = /<span[^>]*class="[^"]*price[^"]*"[^>]*>([^<]+)<\/span>/gi;
    const prices = [];
    while ((match = pricePattern.exec(html)) !== null) {
      const p = match[1].replace(/[^\d.]/g, "").trim();
      if (p) prices.push("¥" + p);
    }

    // Images from Suning CDN
    const imgPattern = /<img[^>]*src="(https?:\/\/[^"]*suning[^"]*(?:jpg|png|jpeg))"/gi;
    while ((match = imgPattern.exec(html)) !== null) {
      if (!images.includes(match[1])) images.push(match[1]);
    }

    for (let i = 0; i < Math.min(urls.length, 6); i++) {
      products.push({
        title: titles[i] ? titles[i].substring(0, 80) : query,
        url: urls[i],
        platform: "苏宁",
        price: prices[i] || "查看详情",
        image: images[i] || "",
      });
    }

    return { products, images };
  } catch (e) {
    console.error("Suning search error:", e.message);
    return { products: [], images: [] };
  }
}

// ─── E-commerce product search — direct scraping of accessible platforms ───
async function searchEcommerce(query) {
  const allProducts = [];
  const allImages = [];
  const seenUrls = new Set();

  // Run Dangdang and Suning searches in parallel (they're accessible to scraping)
  const results = await Promise.allSettled([
    searchDangdang(query),
    searchSuning(query),
    // Also keep Bing image search
    Promise.race([
      bingImageSearch(query),
      new Promise((resolve) => setTimeout(() => resolve([]), 4000)),
    ]).then(imgs => ({ products: [], images: imgs })),
  ]);

  for (const result of results) {
    if (result.status === "fulfilled") {
      for (const p of result.value.products) {
        if (!seenUrls.has(p.url)) {
          seenUrls.add(p.url);
          allProducts.push(p);
        }
      }
      for (const img of result.value.images) {
        if (!allImages.includes(img)) allImages.push(img);
      }
    }
  }

  // Also try to find JD links via Bing search on review sites
  try {
    const jdPages = await Promise.race([
      bingSearch(`${query} 评测 购买 item.jd.com detail.tmall.com`),
      new Promise((resolve) => setTimeout(() => resolve([]), 4000)),
    ]);

    // Try fetching up to 3 review pages to extract JD links
    const pagePromises = jdPages.slice(0, 3).map(async (p) => {
      try {
        const html = await Promise.race([
          fetchHtml(p.url, 5000),
          new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 4000)),
        ]);
        const links = extractProductLinks(html);
        const imgs = extractPageImages(html);
        return { links, imgs };
      } catch {
        return { links: [], imgs: [] };
      }
    });

    const pageResults = await Promise.all(pagePromises);
    for (const { links, imgs } of pageResults) {
      for (const link of links) {
        if (!seenUrls.has(link.url)) {
          seenUrls.add(link.url);
          allProducts.push(link);
        }
      }
      for (const img of imgs) {
        if (!allImages.includes(img)) allImages.push(img);
      }
    }
  } catch (e) {}

  return {
    products: allProducts.slice(0, 8),
    images: allImages.slice(0, 8),
  };
}

// ─── Product image search (for standalone use) ───
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
