import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadKnowledgeBase() {
  const baseDir = path.join(__dirname, "..", "..", "knowledge_base");
  return {
    product_categories: fs.readFileSync(path.join(baseDir, "product_categories.md"), "utf-8"),
    shopping_guide: fs.readFileSync(path.join(baseDir, "shopping_guide.md"), "utf-8"),
    brand_info: fs.readFileSync(path.join(baseDir, "brand_info.md"), "utf-8"),
  };
}

export { loadKnowledgeBase };
