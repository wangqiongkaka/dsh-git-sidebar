# dsh-git-sidebar 项目规则

DSH 右侧边栏的 Git 源代码管理插件。React 18 + TypeScript，Cordis 插件体系，pnpm 管理。

## 目录

- `src/index.ts`：Node 端，注册 `/git-sidebar/api/*` 路由；每个路由先校验参数再调 `src/git.ts`。
- `src/git.ts`：封装 git 命令与输出解析，纯函数尽量可测。
- `src/client/GitView.tsx`：侧边栏主视图（变更、Stash、Tag、历史、提交框、各菜单与弹窗）。
- `src/client/graph.ts`：提交图谱的轨道布局，纯函数。
- `src/client/DiffTab.tsx` / `DiffView.tsx` / `navigation.ts` / `state.ts`：差异标签页及其地址编码。
- `src/client/api.ts`：客户端 RPC 封装，与 `src/index.ts` 的路由一一对应。
- `src/client/locales.ts`：中英文案，`zh` 与 `en` 键必须同时补齐，否则类型检查失败。
- `src/client/sidebar.module.css`：全部样式，只用 DSH 主题令牌 `--dsw-alias-*` / `--dsw-font-*`。
- `tests/`：vitest。`git.spec.ts` 跑真实 git 仓库，`routes.spec.ts` 验证路由与参数注入拒绝，`git-view.spec.tsx` 渲染视图，`graph.spec.ts` 布局算法。

## 命令

```sh
pnpm typecheck
pnpm test          # 34 项
pnpm build         # 产出 lib/，pack 前必须执行
pnpm pack          # 产出 dsh-git-sidebar-<version>.tgz
```

改动交付前三项都要通过；tgz 不入库。

## 安装到 DSH 调试

从 `deepseek-harness` 目录执行。同一版本号重新打包后，`plugin add` 会复用 pnpm 缓存而不更新文件，必须先 remove 再 add：

```sh
pnpm dsh plugin --profile web remove dsh-git-sidebar
pnpm dsh plugin --profile web add file:/绝对路径/dsh-git-sidebar-<version>.tgz
```

装完可比对 `~/.dsh/profiles/web/node_modules/dsh-git-sidebar/lib/client.js` 与本地 `lib/client.js` 的 MD5 确认已更新。然后重启 `pnpm dsh web`，关闭旧标签页、重新打开终端打印的带鉴权 URL；插件包按 immutable 缓存下发，旧标签页只重连不重载。

## 编码约定

- 后端新增路由：参数经 `requireRevision` / `requireCommitHash` / `requireString` 校验，并在 `tests/routes.spec.ts` 的注入拒绝用例里加一条。
- 前端新增 RPC：`api.ts` 加方法，`index.ts` 加路由，命名保持 `git.<kebab-case>`。
- 破坏性操作（放弃、删除、还原、捡取、删分支等）一律走 `runConfirmed` 确认弹窗；不用问号图标或提示气泡解释操作，说明写在弹窗里。
- 菜单：不用图标；会打开弹窗的项标题以「…」结尾，直接执行的不加；按对象分组并用 `type: 'label'` 加组标题；危险项红色置于所在组末尾。
- 文案：所有用户可见文字走 `t()`，不写死；Git 术语保留英文（Add、Stash、Tag、Fetch、Worktree）。
- 样式：不写固定色值和字号令牌以外的数值；行高 32px（历史）/ 34px（文件）/ 36px（分区标题）；折叠按钮只包住标题，不占满整行。
- 每个列表区域各自滚动并有最大高度，提交框固定在面板底部。
- 图谱颜色是唯一允许的字面色值（`GRAPH_COLORS`），分支标签跟随所在轨道颜色。

## 设计稿

界面以 Claude Design 画布为准：https://claude.ai/code/artifact/129dd70a-3e87-48d8-8f90-a2e2f172bf16
（画板：主界面、工作区干净、提交右键菜单、更多操作菜单）。改界面先对照画布；画布上没有的新状态，实现后补一块画板保持同步。已知无法对齐的两处：颜色和字号由主题令牌决定；分支下拉框是原生 select，框内放不了图标。

## 发布

- 改版本号：`package.json` 的 `version` 与 README 安装命令里的 tgz 文件名同步改，删除旧 tgz。
- 提交信息用中文，首行 `feat:` / `fix:` / `docs:` 前缀，正文按条列出改动；推送到 `origin main`。
