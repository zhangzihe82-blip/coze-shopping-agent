import { Router } from "express";

const router = Router();

const DEFAULT_SUGGESTIONS = [
  "帮我推荐一款2000元以内的蓝牙耳机，通勤用",
  "混油皮夏天用什么护肤品好？帮搭配一套",
  "想给男朋友买个生日礼物，500以内有什么推荐？",
  "帮我对比一下iPhone 16和华为Mate 70，哪个拍照好",
  "1000元左右的家用烤箱推荐，新手烘焙入门",
  "适合学生党的游戏本推荐，预算6000以内",
];

router.get("/", (req, res) => {
  res.json({ suggestions: DEFAULT_SUGGESTIONS });
});

export { DEFAULT_SUGGESTIONS };
export default router;
