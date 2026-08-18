# 军训阳光投票站

这是一个可部署至 Cloudflare Pages 的投票站。前端通过 Pages Functions 的 `/api/vote` 接口读写 Cloudflare D1，因此所有访客看到的是同一份票数。

## 1. 上传到 GitHub

在 GitHub 新建仓库，将本目录全部文件推送上去。

## 2. 创建 D1 数据库

在 Cloudflare Dashboard 打开 **Workers 和 Pages → D1 SQL 数据库 → 创建**，数据库名称可填 `military-training-sun-vote`。

复制创建后的 **数据库 ID**，填入 [wrangler.toml](./wrangler.toml) 的 `database_id`。

在本机安装并登录 Wrangler 后，执行：

```bash
npm install -g wrangler
wrangler login
wrangler d1 execute military-training-sun-vote --remote --file=schema.sql
```

## 3. 部署 Pages

Cloudflare Dashboard → **Workers 和 Pages → 创建 → Pages → 连接到 Git**，选择该 GitHub 仓库。

- 构建命令：留空
- 构建输出目录：`.`

首次部署后，进入项目 **Settings → Bindings → Add → D1 database bindings**：

- Variable name：`DB`
- D1 database：选择刚才创建的数据库

保存后重新部署。`functions/api/vote.js` 会自动成为 `/api/vote` 接口。

## 数据与防刷说明

- `vote_events` 记录每位访客每次投票：包含本地生成的匿名访客 ID、投票选项和时间。
- `vote_totals` 保存全站汇总票数，保证读取速度。
- 当前后端限制同一匿名访客 10 秒最多 12 票；页面仍可不限次数投票。
- 正式校园活动建议再在 Cloudflare Dashboard 配置 Turnstile，或接入学校统一认证，避免清除浏览器数据后重复刷票。
