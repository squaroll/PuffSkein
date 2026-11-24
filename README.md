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

## 验证

```shell
npm test
npm run build
```

组件测试覆盖流式中文解码、重复提交、错误恢复、请求清理与时钟更新；测试使用模拟响应，不会调用真实模型 API。
