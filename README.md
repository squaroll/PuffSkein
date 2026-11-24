# PuffSkein

## 介绍
“麻雀虽小、五脏俱全”型**个人日常本地Agent工作台**

目前处于百废待兴阶段，暂只推荐调用deepseek的api

## 启动

1. 克隆该项目
```shell
git clone git@github.com:squaroll/PuffSkein.git
```
2. 配置环境

安装依赖：
```shell
cd PuffSkein
uv sync --locked
npm install
```

在项目根目录复制`.env.example`文件：
```shell
cp .env.example .env
```
自行填充`.env`文件内相应字段。
请勿将包含真实 API Key 的 `.env` 文件提交到 Git 仓库。

需要 Node.js 22.22.2+（22.x）、24.15+（24.x）或 26+，以及 npm；推荐使用 Node.js 24 LTS。前端使用 React + Vite，后端保留 FastAPI。

3. 构建前端并在项目根目录启动服务
```shell
npm run build
uv run uvicorn puffskein.api:app --reload
```
4. 用浏览器打开网址：`http://127.0.0.1:8000`

## 前端开发

在两个终端中分别启动后端和前端：

```shell
uv run uvicorn puffskein.api:app --reload
```

```shell
npm run dev
```

访问 Vite 输出的地址（默认 `http://localhost:5173`），修改 React 组件后页面会自动更新。开发服务器将 `/chat` 请求代理到 `http://127.0.0.1:8000`，仍支持流式响应。

`npm run build` 将前端输出到 `dist/`，由 FastAPI 在 `/` 和 `/static` 提供服务。前端有变更时需要重新构建；`npm run preview` 可本地预览构建结果，聊天功能仍需运行后端。

## 目录结构

```text
frontend/             React 前端源码
  components/         聊天、时钟组件
  App.jsx             应用布局
  main.jsx            React 入口
  style.css           页面样式
src/puffskein/        Python 后端与 Agent
index.html            Vite HTML 入口
vite.config.js        前端构建和开发代理配置
```

API Key 仅配置在根目录 `.env` 中，由后端读取。不要给密钥添加 `VITE_` 前缀，该前缀的变量会被 Vite 暴露给浏览器。

## 联网搜索与会话记忆

Agent 还可调用本地 `get_current_time` 工具获取当前日期、时间和星期。前端自动传入浏览器的本机时区，与 sidebar 保持一致；未传入时区时使用后端系统本地时间，不固定为上海时区。此工具不需要联网，取消勾选“联网搜索”后仍可使用；悬停工具记录可查看实际返回的时间。

在 `.env` 中配置 `TAVILY_API_KEY` 可启用 Tavily 搜索。输入框上方的“联网搜索”默认选中，表示允许模型按需搜索；取消勾选后，本轮对话不会执行搜索。未配置搜索密钥或搜索失败时，工具记录会显示原因。

输出区按顺序保留每轮回答和每次“调用工具【tavily_search】”记录，并显示思考、搜索、回答状态。鼠标悬停工具记录或用键盘聚焦时，会在右侧展示搜索词和实际搜索结果的网页链接；窄屏时展示在记录下方。

Agent 使用 LangGraph `InMemorySaver` checkpoint 保存会话消息。前端通过当前标签页的 `sessionStorage` 保存 `thread_id`，连续发送和刷新后可延续模型上下文；刷新后不会恢复已显示的聊天记录。后端重启会清空记忆，新的独立标签页使用新的会话。当前实现适用于单进程本地运行。

`POST /chat` 接收 `message`、`thread_id`（UUID）、`allow_search` 与可选的 `timezone`（浏览器本机 IANA 时区），返回逐行 JSON（`application/x-ndjson`）。事件类型包括 `status`、`text`、`tool_start`、`tool_end`、`done` 和 `error`。每次工具调用通过唯一 ID 关联搜索结果，前端无需清空先前内容。

## 聊天布局与文本显示

聊天区高度固定为首屏可用高度，长对话在输出区内滚动，输入框保持在聊天区底部。向下滚动页面可查看待办事项等后续栏目。流式回复默认跟随最新内容，手动向上滚动阅读时暂停跟随。

回答使用 `react-markdown`、`remark-gfm` 渲染 Markdown，支持标题、列表、代码块、表格等；通过 `remark-math`、`rehype-katex` 和 KaTeX 显示 LaTeX 公式。行内公式使用 `$x^2$`；独立公式使用单独成行的 `$$` 包围。KaTeX 样式和字体随构建打包，无需从 CDN 加载。

## 验证

```shell
npm test
npm run build
uv run python -m unittest discover -s tests -v
```

测试覆盖流式中文解码、工具调用顺序与链接、搜索开关、会话记忆与隔离、错误恢复、请求清理、待办与时钟更新；测试使用模拟模型和搜索响应，不会调用真实模型或 Tavily API。
