# 故事画布 · Story Canvas

一个为长篇小说创作者设计的**素材库管理 + 画布组合工具**。左侧是可折叠的 Library（插件/维度与其元素），中间是无限画布，你把元素当作卡片拖上画布"作画"，随时展开阅读、编辑，或拼合成 prompt 拿到 AI 官网去投影、推衍。

> 当前版本已经打通本地素材库、画布持久化、导入导出、素材编辑保存、多画布管理和 SSH GitHub commit/push。多模型执行和探索 Path 仍属于后续运行时能力。

---

## 1. 核心概念

| 概念 | 说明 | 例子 |
|------|------|------|
| **Plugin（插件 / 维度）** | 一种"观察方式"，一整片长期积累形成的密度库。不是单个设定。 | 宿主母体、学统、行当、时代情绪、灾变记忆 |
| **Element（元素）** | 某个插件下的一份具体积累，本质是一份 markdown 文档。 | 「维多利亚英国」「北宋汴京」 |
| **Card（卡片）** | 元素被放到画布上的一个实例。同一元素可放多张。 | 画布上的一块墨签 |
| **Canvas（画布）** | 一次"作画"，即一组卡片的摆放与组合。 | 「诡秘底盘」画布 |
| **Projection（投影）** | 把选中的若干卡片内容拼成一段 markdown，复制去 AI 官网。 | — |

Library 存在**本仓库**的 `library/` 目录（见第 4 节），画布状态存**浏览器本地**（见第 5 节）。

---

## 2. 目录结构

\`\`\`
app/
  layout.tsx            根布局、字体（Noto Serif SC / Noto Sans SC）、纸墨主题挂载
  globals.css           全部设计令牌（纸、墨、朱砂 accent）与画布网格样式
  page.tsx              主页面：画布状态机（平移/缩放/拖卡/选中）
  api/library/route.ts  从 library/ 读取 Markdown 和 frontmatter
  api/library/save/     将编辑后的正文写回并 SSH commit/push
  api/library/plugin/   创建新的 Plugin 目录并 SSH commit/push
  api/library/element/  创建新的 Element Markdown 并 SSH commit/push
components/
  top-bar.tsx           顶栏：画布切换、缩放、导入、导出
  library-sidebar.tsx   左侧 Library：全文搜索、标签过滤、插件分组、新建维度/元素
  canvas-card.tsx       画布卡片：三态折叠（墨签/半展/全展入口）
  canvas-edge-layer.tsx 画布卡片关系线的渲染与移除
  path-panel.tsx        Path 节点保存、恢复与分叉
  reader-drawer.tsx     右侧抽屉：读全文 / 编辑 markdown        —— 保存后 SSH commit/push
  projection-bar.tsx    底部投影条：多卡拼合复制为 prompt
lib/
  types.ts              Plugin / ElementDoc / CanvasCard 等类型
  canvas.ts             画布快照校验、导入导出和 Markdown 拼合
  mock-library.ts       历史示例数据（当前未被 UI 引用）
library/                真实 Markdown 素材库
DOCS.md                 本文档
\`\`\`

---

## 3. 交互说明（已实现）

- **放置元素**：左栏点插件名展开 → 点元素 → 落到当前视野中心成为「墨签」卡片。
- **画布平移**：在空白处按住拖动。
- **缩放**：滚轮，以指针为中心，0.3×–2.5×。顶栏「100%」处可一键复位。
- **卡片三态折叠**：
  - `fold 0` 墨签：只有名字，画布 95% 留白靠它维持"呼吸感"。
  - `fold 1` 半展：双击展开，露出摘要与插件归属。
  - 全展：卡片「全文」按钮或列表悬停「读」→ 打开右侧抽屉读整篇。
- **选中与投影**：单击卡片选中（Shift 累加）→ 底部浮出投影条，显示已选数量。
- **编辑**：抽屉内「编辑」进入 markdown 文本区。

---

## 4. Library 读写（本地 Markdown）

**现状**：`library/` 已经包含 5 个维度和 15 个元素。`app/api/library/route.ts` 服务端扫描目录并解析 frontmatter，侧栏通过 `/api/library` 获取数据。

**目标形态**：Library 是本仓库 `library/` 下的两级 markdown：

\`\`\`
library/
  宿主母体/
    维多利亚英国.md
    北宋汴京.md
  学统/
    西方神秘学.md
\`\`\`

每个 `.md` 顶部用 frontmatter 存元数据，正文即元素全文：

\`\`\`markdown
---
title: 维多利亚英国
summary: 雾、煤气灯、报童、薪水、阶级、教会……
tags: [英国, 工业化, 阶级]
---
（正文 markdown）
\`\`\`

侧栏「+ 新维度」可以创建目录和 `_plugin.md` 元数据；每个维度旁的 `+` 可以创建 Element Markdown。两者都会立即通过 SSH commit/push。保存接口会拒绝目录外路径和 `_plugin.md` 元数据文件。

> 类型契约已在 `lib/types.ts` 固定：只要 API 返回同形状数据，UI 无需改动。

---

## 5. 画布持久化（浏览器本地 + 导入导出）

**现状**：`app/page.tsx` 会把每个画布的状态（`cards`、`view`）写入 `localStorage`，画布索引使用 `story-canvas:index`，单个画布使用 `story-canvas:<id>`。

**目标形态**：
- 用 `localStorage` 存多张画布（key 如 `story-canvas:<id>`），随时保存/切换。
- 顶栏「导出」把当前画布导出为 `.json`（结构还原）或 `.md`（拼合后的可读文稿）。
- 支持导入 `.json` 迁移到别的设备。

**已实现**：
- 刷新页面恢复卡片位置、折叠状态和视图缩放。
- 画布快照会保存卡片关系线，旧 JSON 没有 `edges` 时按空数组迁移。
- 顶栏可以导入和导出 JSON。
- 顶栏可以把当前卡片顺序导出为 Markdown。
- 顶栏可以新建、切换和重命名多个本地画布。

**仍待补全**：跨项目/跨设备同步。

---

## 6. 编辑写通道（commit/push 回 GitHub）

**现状**：`reader-drawer.tsx` 的「保存」会调用 `app/api/library/save/route.ts`，保留 frontmatter、把正文写回对应的 Markdown 文件，然后只提交该文件并通过 SSH 推送当前分支。

**目标形态**：保存即写回本仓库对应的 `.md` 文件并提交到当前 GitHub 分支。

当前的「在 GitHub 打开」会跳转到 `shuind/story` 的 `v0/project-69d95889` 分支。推送目标默认是 `git@github.com:shuind/story.git`，也可以通过 `GIT_REMOTE` 覆盖；SSH 程序可以通过 `GIT_SSH` 覆盖。

---

## 7. 投影拼合

**现状**：`projection-bar.tsx` 会按选中卡片顺序，从真实 Library 取正文，拼成带元素标题和插件名的 Markdown 并复制到剪贴板。

**目标形态**：
- **复制为 Prompt**：把所选元素的正文按顺序拼成一段带小标题的 markdown，写入剪贴板（`navigator.clipboard.writeText`），直接粘到 ChatGPT / Claude。
- **逐卡复制**：单张卡片「全文」抽屉里提供「复制本篇」。

当前格式为：

\`\`\`markdown
# 投影素材

## 维多利亚英国（宿主母体）
（正文…）

## 西方神秘学（学统）
（正文…）
\`\`\`

---

## 8. 设计系统

- **字体**：标题/正文 Noto Serif SC（`font-serif`），标签/路径 Noto Sans SC 与等宽回退（`font-mono`）。
- **配色**（`globals.css` 令牌，共 4 色）：`--background` 宣纸米白、`--foreground` 墨、`--muted` 淡墨、`--accent` 朱砂（唯一强调色，克制使用）。
- **原则**：极简、大留白、处处可折叠。画布默认网格极淡，卡片默认收成墨签——"呼吸感"来自画布上永远大片留白。

---

## 9. 扩展状态

以下三项已经实现：

- **全文检索与标签过滤**：搜索标题、摘要、正文和标签；元素 frontmatter 支持 `tags`。
- **Path 最小版本**：保存当前节点、恢复节点、从节点分叉为新画布。
- **卡片间连线**：选中两张卡片后建立带标签的有向关系线；双击连线移除。

仍属于后续可选扩展：

- 元素被"唤醒"频率的可视化（常用的浮起，冷落的沉降）。
