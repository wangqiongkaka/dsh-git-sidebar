# dsh-git-sidebar

将 `dsh-better-sidebar` 的 Git 面板独立接入 DSH 自带的右侧边栏。无需安装或启用 better-sidebar；两个插件可以共存，原插件保持原样。

支持状态分组、暂存/取消暂存、提交、分支切换、fetch/push、merge/rebase 及继续/中止、stash、标签、worktree 创建/打开会话/合并/删除、提交历史、文件与提交差异、丢弃变更、revert/cherry-pick。差异按会话、文件和暂存侧分别打开标签页，布局与分屏由 DSH 管理；文件打开交给 DSH 文件预览器。远端操作使用本机已有的 Git 认证和身份。

## 安装

需要提供 `sidebarRightTabs` 和 `sidebar.right.pane.tab` 的 DSH（本地已按 `0.1.5-rc.2` 接口构建）。在插件目录执行 `pnpm install`、`pnpm build`、`pnpm pack`，再从 DSH 源码目录安装打包产物：

```sh
pnpm dsh plugin --profile web add file:/绝对路径/dsh-git-sidebar-0.1.0.tgz
```

使用已安装的 DSH CLI 时去掉前面的 `pnpm`。重新启动对应 Web 服务后，打开会话右上角自带侧边栏，在引导页选择「源代码管理」。已有标签页时可通过标签栏的「+」回到引导页。

开发依赖的 `link:` 指向相邻 `deepseek-harness` 源码 checkout；打包产物不依赖该路径或 better-sidebar。搬动目录后需调整开发链接。

## 配置和安全

通过 profile 的 `cordis.patch.yml` 覆盖 `git-sidebar` 行的 `config.readLimit`，调整未跟踪文件的文本预览上限，默认 2 MiB。Git 操作走独立的 `/git-sidebar/api/*` 路由，保留 Host/Origin 浏览器请求检查、请求体大小限制、会话工作目录解析及危险操作确认。插件使用本机 Git，不改变用户的全局 Git 配置。

## 验证

`pnpm typecheck`、`pnpm test`（30 项）和 `pnpm build` 已通过。已在仅安装本插件的临时 profile 中检查原生侧边栏入口、Git 状态列表、文件差异和暂存操作；未执行用户仓库的提交、推送或丢弃操作。远端联网 push/fetch 未实测。

代码和界面提取自 MIT 许可的 `DSH-better-sidebar` 0.14.0；浏览器请求检查保留原文件注明的上游来源。
