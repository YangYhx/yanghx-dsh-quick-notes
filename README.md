# 随手记 · Quick Notes

[![npm version](https://img.shields.io/npm/v/@yanghx/dsh-quick-notes)](https://www.npmjs.com/package/@yanghx/dsh-quick-notes)

DeepSeek Harness 插件：⌘⇧N 随手记一笔，按天归档成本地 Markdown。

## 安装

插件市场收录后，在桌面端 **插件市场** 搜索 `quick-notes` 或 `随手记`，一键安装。

也可直接装包（装完需在 profile 里接线，见下方「卸载」反向操作）：

```bash
npm i @yanghx/dsh-quick-notes
```

## 用起来

| 入口 | 操作 |
| --- | --- |
| 速记浮层 | `⌘⇧N`（Windows / Linux `Ctrl+Shift+N`），任意页面可用，包括正在输入时 |
| 侧栏面板 | 左侧栏「随手记」图标，看时间线、搜索、编辑、删除、切笔记本、管理笔记本 |
| 文件本身 | 直接用 Finder / 编辑器打开当天 `.md` |

浮层里 `⏎` 保存，`⇧⏎` 换行，`esc` 关闭；保存后面板里的列表会立刻多一条。
列表里每条默认预览 3 行，超出的点「展开全文」；hover 一条笔记可以复制、编辑、删除。
编辑是行内改：`⌘⏎` 保存，`esc` 取消，时间戳保持不变。

## 笔记本（保存目录）

每个笔记本 = 一个名字 + 一个目录。面板顶部下拉切换，一次只看一个笔记本；
速记（⌘⇧N 浮层和面板速记框）永远写入**当前选中**的笔记本。

- 默认笔记本：`~/Documents/随手记`
- 面板右上角齿轮 → 设置抽屉：添加笔记本（起名字 + 选文件夹）、设为当前、重命名、移除
- 「移除」只解除关联，**绝不删除文件**；至少要保留一个笔记本
- 换笔记本不会搬文件；旧目录里的内容原地不动

## 文件格式

一天一个文件：`YYYY-MM-DD.md`

```markdown
# 2026-11-05 星期三

- 10:25 先把方案定下来
- 11:02 多行的一条
  第二行
```

续行用两个空格缩进，所以一条里写多少行都不会被拆开。

- 插件自己的配置：`~/.dsh/quick-notes/config.json`（`{"vaults": {"名字": "/绝对路径"}, "active": "名字"}`）
- 旧格式 `{"vault": "/路径"}` 会自动迁移成 `{"vaults": {"默认": "/路径"}, "active": "默认"}`
- 任一目录不可写时，保存会被整体拒绝，配置保持不变

## 边界

- 面板里可以新增、编辑、删除；编辑只改正文，保留原来的时间戳
- 不做云同步、导出、系统级全局热键（Electron 主进程的 `globalShortcut` 插件碰不到）
- 只加载最近 60 天、最多 400 个文件；更早的点「加载更早」按需翻
- 同一时刻只保证单个进程内不写乱（按日期串行队列），不做跨进程文件锁

## 开发

```bash
node dev/smoke.mjs   # 宿主端全链路测试（临时目录，不碰真实数据）
```

结构：

- `index.js`：宿主半部。`/api/quick-notes` 前缀路由 + 文件读写 + 配置；纯 Node 内置模块，零依赖
- `client.js`：浏览器半部。侧栏面板、速记浮层、设置抽屉；样式只用 `--dsw-alias-*` 主题 token
- `cordis.patch.yml`：把宿主半部插进插件树（id `quick-notes`）

## 卸载

1. 从 `~/.dsh/profiles/desktop/package.json` 的 `dsh.profile.bundles` 里删掉 `@yanghx/dsh-quick-notes`
2. 删掉 `~/.dsh/profiles/desktop/node_modules/@yanghx/dsh-quick-notes`
3. 重启 DeepSeek Harness

笔记文件不会被删。
