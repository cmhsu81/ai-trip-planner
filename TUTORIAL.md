# AI Trip Planner — 從 0 開始的漸進式教學

這份教學會帶你從一個空資料夾開始，一步步做出這個專案：使用者輸入天數 / 目的地 / 偏好，AI（Claude）會上網搜尋最新的景點、餐廳評價與新聞天氣資訊，排出完整行程，使用者可以勾選確認、刪除、編輯或用對話框請 AI 修改，並把行程存進資料庫，支援中英文切換。

適合放進履歷的重點技術：**Next.js + TypeScript（前端）、Node.js + Express + TypeScript（後端）、PostgreSQL + Prisma ORM（資料庫）、JWT 驗證、Claude API 的 tool use / web search（LLM 整合與 prompt engineering）**。

> 目前 repo 裡的程式碼已經是照著這份教學做完的成果。你可以直接讀程式碼對照教學，或是刪掉重寫、跟著手動打一遍加深印象——後者更適合放進履歷時能講清楚每個決定的理由。

---

## Phase 0：前置準備

1. **安裝 Node.js 20+**：`node -v` 確認版本。
2. **申請 Anthropic API Key**：到 https://console.anthropic.com/ 註冊、建立 API key（Claude API 是付費按用量計費，這個專案用到的 `web_search` 工具另外收費，每 1000 次搜尋 $10 美金 + token 費用，開發階段花費很小，但建議設定用量上限）。
3. **申請免費雲端 PostgreSQL**：推薦 [Neon](https://neon.tech)（或 [Supabase](https://supabase.com)）。註冊後建立一個新 project，會拿到一組連線字串，格式像：
   ```
   postgresql://USER:PASSWORD@HOST/dbname?sslmode=require
   ```
   先複製起來，等一下後端會用到。這一步完全不需要在本機安裝 Docker 或 PostgreSQL server。
4. **GitHub 帳號 + 建立一個空 repository**（例如 `ai-trip-planner`）。
5. 編輯器建議用 VS Code。

---

## Phase 1：專案骨架與資料夾結構

這是一個 **monorepo**（單一 repo 裡放前後端兩個獨立專案），因為前端是 Next.js、後端是獨立的 Node.js/Express server：

```
ai-trip-planner/
├── backend/     # Node.js + Express + TypeScript + Prisma
├── frontend/    # Next.js + TypeScript + Tailwind
├── README.md
└── TUTORIAL.md
```

```bash
mkdir ai-trip-planner && cd ai-trip-planner
git init
mkdir backend frontend
```

---

## Phase 2：後端 — 初始化與基礎設定

### 2.1 初始化 npm 專案

```bash
cd backend
npm init -y
```

### 2.2 安裝依賴

```bash
npm install express cors dotenv bcryptjs jsonwebtoken zod @prisma/client @anthropic-ai/sdk
npm install -D typescript tsx prisma @types/node @types/express @types/cors @types/bcryptjs @types/jsonwebtoken
```

- `express`：HTTP server 框架
- `zod`：request body 驗證（避免髒資料進到資料庫，也是後端很常見的實務作法）
- `bcryptjs` / `jsonwebtoken`：密碼雜湊與登入用的 JWT
- `@prisma/client` + `prisma`：TypeScript ORM，幫你把資料表變成型別安全的 API
- `@anthropic-ai/sdk`：呼叫 Claude API 的官方 SDK
- `tsx`：開發時直接跑 TypeScript，不用另外編譯

### 2.3 `tsconfig.json`

建立 `backend/tsconfig.json`，設定 `strict: true`（養成寫嚴謹 TypeScript 的習慣，履歷加分），`rootDir: src`、`outDir: dist`。

### 2.4 環境變數

建立 `backend/.env.example`（放進 git，當作範本）與 `backend/.env`（**不要**放進 git，`.gitignore` 已經排除）：

```
PORT=4000
CORS_ORIGIN=http://localhost:3000
DATABASE_URL=postgresql://...你的 Neon 連線字串...
JWT_SECRET=一組隨機長字串
JWT_EXPIRES_IN=7d
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-5
```

`src/config/env.ts` 統一讀取並驗證這些變數，其他程式碼都從這裡拿設定值，而不是到處寫 `process.env.XXX`——這樣缺變數時會在啟動時就直接報錯，而不是等到某個 request 才爆炸。

---

## Phase 3：資料庫 Schema（Prisma）

`backend/prisma/schema.prisma` 定義了 5 張表：

- **User**：email + 雜湊後密碼
- **Trip**：一趟旅程（目的地、天數、偏好設定、AI 產生的摘要）
- **ItineraryDay**：行程的「第幾天」
- **ItineraryItem**：某一天裡的一個行程項目（景點/餐廳/活動/交通/住宿），有 `confirmed` 欄位對應「使用者勾選確認」
- **ChatMessage**：對話紀錄，讓「用對話框調整行程」有歷史脈絡可以延續

關聯設計：`User 1—N Trip 1—N ItineraryDay 1—N ItineraryItem`，`Trip 1—N ChatMessage`。這種一對多關聯 + cascade delete（刪 Trip 自動刪底下的 day/item）是關聯式資料庫設計的基本功，履歷上可以寫「設計正規化的關聯式資料庫 schema」。

把 `.env` 的 `DATABASE_URL` 填好之後，執行：

```bash
npx prisma migrate dev --name init
```

這個指令會：
1. 連到 Neon 資料庫
2. 產生 SQL migration 檔案（記錄了資料庫結構的變更歷史，之後改 schema 都會留下版本紀錄）
3. 實際在資料庫建表
4. 產生型別安全的 Prisma Client（`src/db/prisma.ts` 匯出的 `prisma` 物件）

你可以用 `npx prisma studio` 打開一個網頁版的資料庫管理介面，很適合 demo 用。

---

## Phase 4：後端 — 驗證機制（JWT）

- `src/utils/jwt.ts`：簽發/驗證 JWT
- `src/middleware/auth.ts`：`requireAuth` middleware，檢查 `Authorization: Bearer <token>`，驗證通過才把 `req.user` 填進去，讓後面的 controller 知道是誰在呼叫
- `src/controllers/auth.controller.ts` + `src/routes/auth.routes.ts`：
  - `POST /api/auth/register`：用 `bcrypt.hash` 雜湊密碼存起來，回傳 JWT
  - `POST /api/auth/login`：用 `bcrypt.compare` 驗證密碼，回傳 JWT

前端把拿到的 JWT 存在 `localStorage`，之後每次呼叫受保護的 API 都帶在 `Authorization` header 裡。這是最簡單、不依賴第三方服務的驗證方式，履歷上可以寫「實作基於 JWT 的無狀態身份驗證機制」。

---

## Phase 5：後端 — AI 行程規劃核心（重點功能）

這是整個專案最有技術含量、也最適合在履歷/面試中詳細講的部分：`src/services/anthropic.service.ts`。

### 5.1 為什麼用 Claude 的 `web_search` 工具，而不是自己接 Google Maps / TripAdvisor / Yelp API？

- 三個 API 各自要申請金鑰、有各自的用量限制與條款，整合成本高
- Claude API 內建的 `web_search` 工具讓模型自己決定何時要上網查資料（例如「這個城市最近的熱門景點」「近兩年的新聞」「當地天氣型態」），並自動附上來源引用
- 這樣可以用同一組呼叫涵蓋「景點/餐廳評價」「新聞」「天氣/活動」多種資訊需求，非常適合這種需要「即時、多面向資訊整合」的應用

```ts
const WEB_SEARCH_TOOL: Anthropic.Messages.WebSearchTool20250305 = {
  type: "web_search_20250305",
  name: "web_search",
  max_uses: 8,
};
```

呼叫 `client.messages.create({ model, tools: [WEB_SEARCH_TOOL], system, messages })` 時，Claude 會在單一個 API request 裡自行判斷要不要搜尋、搜幾次（這裡設上限 8 次避免失控），伺服器端處理完才把最終文字回傳給你。

### 5.2 如何讓 LLM 回傳「結構化資料」而不是自由文字

行程需要存進資料庫、前端需要渲染成 checklist，所以不能讓 AI 隨便回文章。做法是在 **system prompt** 裡明確定義 JSON 結構（見 `ITINERARY_JSON_SHAPE`），並要求「只回傳這個 JSON，不要有其他文字」。拿到回應後用 `extractJson()` 做防禦性解析（先找 ```json fenced block，找不到就找第一個 `{` 到最後一個 `}`），避免模型偶爾多講幾句話就整個 parse 失敗。

這是 LLM 應用工程很核心的技巧：**prompt 設計 + 輸出格式約束 + 容錯解析**，履歷上可以寫「設計 structured output prompting 策略，將 LLM 回應可靠地轉換為型別安全的資料結構」。

> 進階做法：之後可以改用 Claude 的 [tool use / structured outputs](https://platform.claude.com/docs) 讓格式更嚴謹（用一個「儲存行程」的 tool definition 取代純文字 JSON），是很好的履歷加分延伸項目。

### 5.3 兩個核心 function

- `generateItinerary(params)`：接收目的地/天數/偏好，組出 prompt，要求 Claude 研究後回傳完整行程 JSON
- `chatRefine(params)`：把「目前的行程 JSON」放進 system prompt，加上對話歷史與使用者這句話，讓 Claude 回傳 `{ reply, updatedItinerary }`——這就是「對話框調整行程」的實作核心

### 5.4 API 層

- `POST /api/ai/generate`：建立 Trip、呼叫 `generateItinerary`、把結果寫進 `ItineraryDay`/`ItineraryItem`（`itinerary.service.ts` 的 `replaceTripItinerary` 用 `prisma.$transaction` 整批刪除重建，確保資料一致）
- `POST /api/ai/chat`：讀出目前行程 + 歷史對話、呼叫 `chatRefine`、把新的使用者訊息與 AI 回覆存進 `ChatMessage`、用新行程覆蓋資料庫

---

## Phase 6：後端 — 行程 CRUD（勾選 / 刪除 / 編輯）

`src/controllers/trips.controller.ts`：

- `GET /api/trips`：列出使用者所有行程（「我的行程」頁面用）
- `GET /api/trips/:id`：單一行程完整內容
- `PATCH /api/trips/:id`：改標題
- `DELETE /api/trips/:id`：刪除整趟行程
- `PATCH /api/trips/:tripId/items/:itemId`：**編輯單一行程項目**——改標題/時間/時長/描述，或切換 `confirmed`（對應前端的勾選框）
- `DELETE /api/trips/:tripId/items/:itemId`：**刪除單一行程項目**

「替換成其他」有兩種做法都實作了：手動編輯欄位（PATCH），或是點「🔁 AI」按鈕，把預填好的訊息送進聊天框讓 AI 幫你換一個更好的建議（會重新觸發 web_search）。「時間延長」就是編輯 `estimatedDuration` 欄位。

每個 mutation 都先確認這筆資料屬於目前登入的使用者（`assertItemOwnership`），避免 A 使用者改到 B 使用者的行程——這是後端最基本、也最容易被面試官問到的安全細節（authorization vs authentication 的差別）。

---

## Phase 7：後端 — 串起來 & 本機測試

`src/index.ts` 把 CORS、JSON body parser、三組路由（`/api/auth`、`/api/trips`、`/api/ai`）跟統一錯誤處理（`errorHandler`）串起來。

```bash
npm run dev
# 另開一個 terminal
curl http://localhost:4000/api/health
# 應該回傳 {"status":"ok"}
```

---

## Phase 8：前端 — 初始化 Next.js

```bash
cd ../frontend
npx create-next-app@latest . --typescript --eslint --tailwind --app --src-dir --import-alias "@/*"
```

這裡選了 **App Router**（Next.js 現在的主流架構）、TypeScript、Tailwind CSS（快速刻版面，不用另外寫一堆 CSS 檔案）。

安裝完後資料夾長這樣：`src/app`（路由）、`src/components`、`src/contexts`、`src/lib`、`src/types`。

新增 `frontend/.env.local.example`：
```
NEXT_PUBLIC_API_URL=http://localhost:4000/api
```
複製成 `.env.local`（會被 git 忽略）。Next.js 只有 `NEXT_PUBLIC_` 開頭的變數會被打包進前端 JS，這是刻意的安全機制，避免你不小心把後端密鑰洩漏到瀏覽器。

---

## Phase 9：前端 — 全域狀態（i18n + 登入狀態）

- `src/lib/i18n/en.json` / `zh.json`：兩份翻譯字典
- `src/contexts/LocaleContext.tsx`：`LocaleProvider` 提供 `t(key)` 翻譯函式，切換語言時存進 `localStorage`，重新整理後還記得使用者選擇
- `src/contexts/AuthContext.tsx`：管理登入使用者、`login`/`register`/`logout`，JWT 存 `localStorage`
- `src/components/LanguageSwitcher.tsx`：中文/EN 切換按鈕
- `src/app/layout.tsx`：用 `LocaleProvider` + `AuthProvider` 包住整個 app，並放上共用的 `Navbar`

這兩個 Context 是「全域狀態不用 Redux/Zustand，用 React Context 就夠」的典型例子，適合中小型專案，履歷上可以寫「使用 React Context 實作跨頁面共享的驗證狀態與多語系切換」。

---

## Phase 10：前端 — API 串接層

`src/lib/api.ts` 是一個很薄的 `fetch` wrapper：自動帶上 `NEXT_PUBLIC_API_URL` 前綴、自動夾帶 `Authorization` header（如果有登入）、統一把非 2xx 回應轉成 `ApiError` 丟出去，讓每個頁面的 `try/catch` 都可以用同一種方式處理錯誤。

---

## Phase 11：前端 — 登入 / 註冊頁

`src/app/login/page.tsx`、`src/app/register/page.tsx`：受控表單 + `useAuth()`，成功後導向 `/trips`。

---

## Phase 12：前端 — 規劃行程主頁（核心互動）

`src/app/page.tsx` 是整個 app 的主畫面，串起三個元件：

1. **`PlannerForm`**：目的地、天數、出發日期、興趣、指定景點/餐廳、旅遊風格、預算 → 送出後呼叫 `POST /api/ai/generate`
2. **`ItineraryView`**：把回傳的 `itineraryDays` 渲染成每天的清單，每個項目有：
   - ☑️ checkbox（對應 `confirmed`，勾選狀態即時 PATCH 回後端）
   - 「編輯」→ 切換成表單，改完 PATCH
   - 「🔁 AI」→ 把「請幫我把這個換成別的」訊息預填進聊天框
   - 「刪除」→ DELETE
3. **`ChatPanel`**：對話框，送出訊息呼叫 `POST /api/ai/chat`，回傳的新行程會整個覆蓋畫面上的 `itineraryDays`

這頁示範了「AI 生成 → 使用者微調（結構化操作）→ AI 再生成（對話式操作）」兩種修改行程的方式並存，也是這個專案在履歷上最值得展開講的互動設計。

---

## Phase 13：前端 —「我的行程」頁

- `src/app/trips/page.tsx`：列出所有行程、可刪除、可點進去看
- `src/app/trips/[id]/page.tsx`：跟首頁很像，但是載入既有的行程資料而不是從表單生成新的

---

## Phase 14：本機完整測試流程

1. 後端：`cd backend && npm run dev`（http://localhost:4000）
2. 前端：`cd frontend && npm run dev`（http://localhost:3000）
3. 瀏覽器打開 http://localhost:3000
4. 註冊帳號 → 自動登入
5. 填寫目的地/天數 → 「產生行程」（第一次呼叫會花數秒到十幾秒，因為 Claude 要上網搜尋）
6. 勾選/刪除/編輯行程項目，確認畫面即時更新、重新整理後資料還在（代表真的寫進資料庫了）
7. 在對話框輸入「把第二天的午餐換成別的」測試 AI 調整
8. 切換右上角中文/EN，確認介面文字跟著換
9. 到「我的行程」確認剛剛的行程有列出來

---

## Phase 15：推上 GitHub

```bash
cd ai-trip-planner
git add .
git status   # 確認 .env / .env.local 沒有被加進來
git commit -m "..."
git branch -M main
git remote add origin git@github.com:<你的帳號>/ai-trip-planner.git
git push -u origin main
```

**務必**再三確認 `backend/.env` 和 `frontend/.env.local`（含有 API 金鑰、資料庫密碼）沒有被 commit——這個專案的 `.gitignore` 已經排除它們，但養成 push 前看一眼 `git status` 的習慣是好的實務。

---

## 之後可以繼續延伸（讓專案更完整、更適合面試展開講）

- **部署**：前端丟 Vercel（跟 Next.js 是同一家公司做的，設定最簡單），後端丟 Render / Railway / Fly.io，資料庫已經是雲端的 Neon 不用動
- **Docker 化**：幫前後端各寫一份 `Dockerfile` + `docker-compose.yml`，履歷可以加一條「容器化部署」
- **測試**：後端用 Vitest/Jest 寫 API 整合測試，前端用 Playwright 寫 E2E（這個 repo 開發過程就是用 Playwright 做過視覺驗證）
- **CI/CD**：GitHub Actions 在 PR 時自動跑 `tsc --noEmit`、`eslint`、`next build`
- **更嚴謹的 structured output**：改用 Claude tool use 定義「儲存行程」工具，取代目前用 system prompt 要求純 JSON 的做法
- **RAG / 快取**：熱門城市的行程資訊快取起來，減少重複的 web_search 呼叫、加快回應速度、省錢
- **地圖視覺化**：把 `location` 欄位串 Google Maps Embed API，行程表旁邊加一張地圖

---

## 履歷可以怎麼寫

給你參考的 bullet point 範例（依你實際做到的程度調整）：

> **AI Trip Planner** — 全端旅遊行程規劃應用（Next.js / TypeScript / Node.js / PostgreSQL / Claude API）
> - 設計並實作全端應用，整合 Claude API 的 web search 工具，讓 LLM 即時查詢景點評價、近期新聞與天氣資訊，動態生成可行性評估後的旅遊行程
> - 設計 structured output prompting 策略與容錯解析邏輯，將 LLM 自由格式回應可靠地轉換為型別安全的資料結構並持久化
> - 用 Prisma 設計正規化的關聯式資料庫 schema（使用者/行程/每日行程/行程項目/對話紀錄），支援使用者歷史紀錄查詢
> - 實作 JWT 身份驗證與資源層級的授權檢查，確保使用者只能存取/修改自己的資料
> - 打造支援即時編輯（勾選確認/刪除/修改）與對話式調整（chatbot）雙軌互動的行程管理介面，並支援中英文切換
