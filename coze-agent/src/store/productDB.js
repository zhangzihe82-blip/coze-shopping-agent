// 店铺商品数据库（预留模块）
// 后续用于替代全网搜索，将导购范围限定在店铺内商品

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "..", "..", "data", "products.json");

let products = [];

function loadProducts() {
  try {
    if (fs.existsSync(DB_PATH)) {
      products = JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
    }
  } catch (e) {
    console.error("商品库加载失败:", e.message);
    products = [];
  }
  return products;
}

function getProducts() {
  return products;
}

function getProductById(id) {
  return products.find((p) => p.id === id) || null;
}

function searchProducts(query) {
  const q = query.toLowerCase();
  return products.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      (p.tags || []).some((t) => t.toLowerCase().includes(q))
  );
}

function getCategories() {
  return [...new Set(products.map((p) => p.category))];
}

export { loadProducts, getProducts, getProductById, searchProducts, getCategories };
