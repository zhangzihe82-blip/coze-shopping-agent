import { Router } from "express";
import { searchProductImages } from "../search/webSearch.js";

const router = Router();

router.post("/search", async (req, res) => {
  const { query } = req.body;
  if (!query) {
    return res.status(400).json({ error: "query is required" });
  }

  try {
    const images = await searchProductImages(query);
    res.json({ images });
  } catch (e) {
    console.error("Image search error:", e.message);
    res.json({ images: [] });
  }
});

export default router;
