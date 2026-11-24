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

3. 构建前端并在项目根目录启动服务
```shell
npm run build
uv run uvicorn puffskein.api:app --reload
```
4. 用浏览器打开网址：`http://127.0.0.1:8000`
