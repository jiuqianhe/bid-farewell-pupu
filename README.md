# 告别蒲蒲｜Vite + Vercel + DeepSeek

这是完整的“告别蒲蒲”交互原型工程。前端使用 Vite 构建，`api/chat.js` 是 Vercel Node.js Function，浏览器只向同源 `/api/chat` 发送一次性问题。

## 安全约束

- DeepSeek 密钥只由 `api/chat.js` 从 `process.env.DEEPSEEK_API_KEY` 读取。
- 前端没有 DeepSeek 官方地址，也不会收到或保存 API 密钥。
- 服务端仅接受同源 POST JSON，请求正文和单条消息都有长度限制。
- 上游请求 24 秒超时，不返回 DeepSeek 的原始错误正文。
- `.env`、`.env.local`、`.vercel`、`node_modules` 和 `dist` 已加入 `.gitignore`。

## 安装与构建

要求 Node.js 20.19 或更高版本。

```bash
npm install
npm run test
npm run build
npm run preview
```

`npm run build` 会输出完整的 `dist/`，包括主原型、全部图片素材和 `private-island/` 子页面。`npm run preview` 只能预览静态构建，不能运行 `/api/chat`。

## 本地测试完整聊天链路

1. 复制 `.env.example` 为 `.env.local`。
2. 在 `.env.local` 中填写 `DEEPSEEK_API_KEY=你的密钥`。不要把该文件提交到 Git。
3. 在项目根目录运行：

```bash
npx vercel dev
```

4. 按终端提示关联或新建 Vercel 项目，然后打开终端显示的本地地址，通常是 `http://localhost:3000`。
5. 进入“栖所 → 陪我说说话”，发送一句文字。浏览器网络面板中应只出现 `POST /api/chat`。

## 部署到 Vercel

1. 将整个项目推送到 GitHub，或在项目根目录运行 `npx vercel`。
2. 在 Vercel 项目 Settings → Environment Variables 中新增 `DEEPSEEK_API_KEY`，至少勾选 Production；如需预览部署也可勾选 Preview。
3. 重新部署。Vercel 会执行 `npm run build`，读取 `vercel.json`，发布 `dist/` 并部署 `api/chat.js`。

不要在 `vercel.json`、前端代码、GitHub 仓库或截图中填写真实密钥。
