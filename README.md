# AI Trip Planner

用 AI 規劃旅遊行程的全端網頁應用。使用者輸入天數、目的地與偏好，Claude 會上網搜尋熱門景點、餐廳評價、近期新聞與天氣資訊，產生完整行程表；使用者可以勾選確認、刪除、編輯行程項目，也可以透過對話框請 AI 調整（換景點、延長停留時間等），所有行程都會存進資料庫，支援中英文介面切換。

📘 **想從零開始照著做一遍？看 [TUTORIAL.md](./TUTORIAL.md)** —— 完整漸進式教學，包含每個技術決策的原因，適合當作學習筆記或面試前複習。

## 技術棧

| | |
|---|---|
| 前端 | Next.js (App Router) + TypeScript + Tailwind CSS |
| 後端 | Node.js + Express + TypeScript |
| 資料庫 | PostgreSQL（Prisma ORM，可用 [Neon](https://neon.tech) / [Supabase](https://supabase.com) 免費方案） |
| AI | Claude API（`@anthropic-ai/sdk`），使用 `web_search` 工具即時查詢資料 |
| 驗證 | JWT（email/password 登入） |

## 功能

- 依天數、目的地、興趣、指定景點/餐廳、旅遊風格、預算，AI 產生完整每日行程
- AI 會上網搜尋熱門景點/餐廳評價、近 1–2 年新聞、天氣等資訊作為規劃依據，並給出可行性評估
- 行程項目可勾選確認、刪除、編輯（改時間/時長/描述），或請 AI 換一個
- 對話框可持續與 AI 討論、即時調整行程
- 「我的行程」頁面保存所有歷史行程
- 中文 / English 介面切換

## 專案結構

```
ai-trip-planner/
├── backend/    # Express API server
├── frontend/   # Next.js app
└── TUTORIAL.md # 從零開始的完整教學
```

## 快速開始

### 1. 後端

```bash
cd backend
npm install
cp .env.example .env   # 填入 DATABASE_URL、JWT_SECRET、ANTHROPIC_API_KEY
npx prisma migrate dev --name init
npm run dev             # http://localhost:4000
```

### 2. 前端

```bash
cd frontend
npm install
cp .env.local.example .env.local   # 預設指向 http://localhost:4000/api
npm run dev              # http://localhost:3000
```

詳細的每一步說明、設計理由、以及後續可延伸的方向，請見 [TUTORIAL.md](./TUTORIAL.md)。
