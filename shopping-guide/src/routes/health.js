import { Router } from "express";
import { getSessionCount } from "../agent/sessionManager.js";
import { DEEPSEEK_MODEL } from "../config/deepseek.js";

const router = Router();

router.get("/", (req, res) => {
  res.json({
    status: "ok",
    sessions: getSessionCount(),
    llm: DEEPSEEK_MODEL,
  });
});

export default router;
