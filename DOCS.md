# 故事画布 · Story Canvas

一个为长篇小说创作者设计的**素材库管理 + 画布组合工具**。左侧是可折叠的 Library（插件/维度与其元素），中间是无限画布，你把元素当作卡片拖上画布"作画"，随时展开阅读、编辑，或拼合成 prompt 拿到 AI 官网去投影、推衍。

> 当前版本是 **UI 与框架骨架**。所有对外的真实功能（读写文件、提交 GitHub、持久化画布）都以清晰的**占位点位**标出，尚未接入实现。本文档说明整体结构与每个点位如何补全。

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
components/
  top-bar.tsx           顶栏：画布名、缩放、导出            —— 占位：切换画布 / 导出
  library-sidebar.tsx   左侧 Library：搜索、插件分组、元素列表 —— 占位：新维度
  canvas-card.tsx       画布卡片：三态折叠（墨签/半展/全展入口）
  reader-drawer.tsx     右侧抽屉：读全文 / 编辑 markdown        —— 占位：保存(commit) / GitHub 直达
  projection-bar.tsx    底部投影条：多卡拼合复制为 prompt        —— 占位：拼合逻辑
lib/
  types.ts              Plugin / ElementDoc / CanvasCard 等类型
  mock-library.ts       示例 Library 数据（5 个插件，含示例元素全文）
library/                （待建）真实 markdown 素材库
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

## 4. 占位点位一：Library 读写（GitHub）

**现状**：`lib/mock-library.ts` 提供硬编码示例数据，`library-sidebar.tsx` 直接读它。

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
---
（正文 markdown）
\`\`\`

**补全步骤**：
1. 建 `library/` 目录与实际 md 文件。
2. 加一个服务端读取层（如 `app/api/library/route.ts` 用 `fs` + `gray-matter` 解析 frontmatter），返回与 `lib/types.ts` 中 `Plugin[]` 同形状的数据。
3. 把 `library-sidebar.tsx` 里对 `mockLibrary` 的引用换成 `useSWR('/api/library')`。
4. **保存/新增/新维度** → 见占位点位三。

> 类型契约已在 `lib/types.ts` 固定：只要 API 返回同形状数据，UI 无需改动。

---

## 5. 占位点位二：画布持久化（浏览器本地 + 导出）

**现状**：画布状态（`cards`、`view`）只存在 React state，刷新即丢。

**目标形态**：
- 用 `localStorage` 存多张画布（key 如 `story-canvas:<id>`），随时保存/切换。
- 顶栏「导出」把当前画布导出为 `.json`（结构还原）或 `.md`（拼合后的可读文稿）。
- 支持导入 `.json` 迁移到别的设备。

**补全点位**：
- `app/page.tsx` — `cards` / `view` 变化时 `useEffect` 写入 localStorage；挂载时读回。
- `top-bar.tsx` — `onExport` 目前是占位按钮，接入下载逻辑。
- `top-bar.tsx` — 画布名旁的下拉（当前只有 UI）接入「多画布列表 / 新建 / 切换」。

---

## 6. 占位点位三：编辑写通道（commit 回 GitHub）

**现状**：`reader-drawer.tsx` 的「编辑」进入文本区，「保存」按钮存在但只关闭编辑态，不落盘。

**目标形态**：保存即把改动 commit 回本仓库对应的 `.md` 文件。

**补全步骤**：
1. 新增 `app/api/library/save/route.ts`：接收 `{ pluginId, elementId, content }`，写入对应 md 文件。
2. 在 v0 环境中，写入本仓库文件后由平台的 Git 流程提交；若要**独立仓库 + 直接调 GitHub API**，需请求 `GITHUB_TOKEN` 环境变量并用 Octokit 的 `createOrUpdateFileContents`。
3. `reader-drawer.tsx` 的 `onSave` 调该 API，成功后乐观更新本地缓存。
4. 「在 GitHub 打开」按钮：拼出 `https://github.com/<org>/<repo>/blob/<branch>/library/<plugin>/<element>.md` 直接跳转。

---

## 7. 占位点位四：投影拼合

**现状**：`projection-bar.tsx` 显示已选卡片数与两个按钮（「复制为 Prompt」「逐卡复制」），拼合函数是占位。

**目标形态**：
- **复制为 Prompt**：把所选元素的正文按顺序拼成一段带小标题的 markdown，写入剪贴板（`navigator.clipboard.writeText`），直接粘到 ChatGPT / Claude。
- **逐卡复制**：单张卡片「全文」抽屉里提供「复制本篇」。

**补全点位**：`projection-bar.tsx` 里根据 `selectedElementIds` 从 Library 取正文拼接；建议格式：

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

## 9. 后续可选扩展

- 卡片间连线（表达元素的叠加/投影关系）。
- 元素被"唤醒"频率的可视化（常用的浮起，冷落的沉降）。
- Path：记录一次探索轨迹，可回到任一岔口另走一条。
- 全文检索与标签过滤。
