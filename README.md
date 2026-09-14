# dsh-git-sidebar

为 DSH 自带的右侧边栏提供 Git 源代码管理面板，在会话中查看变更、管理分支和处理代码差异。

## 功能

- 变更管理：状态分组、暂存、取消暂存、提交和丢弃变更。
- 分支与远端：分支切换、fetch/push、merge/rebase 及继续或中止操作。
- 历史与差异：提交历史、文件与提交差异、revert/cherry-pick。
- 工作区管理：stash、标签，以及 worktree 创建、打开会话、合并和删除。

差异按会话、文件和暂存侧分别打开标签页，布局与分屏由 DSH 管理；文件通过 DSH 文件预览器打开。远端操作使用本机已有的 Git 认证和身份。

## 安装

需要提供 `sidebarRightTabs` 和 `sidebar.right.pane.tab` 的 DSH（本地已按 `0.1.5-rc.2` 接口构建）。开发依赖的 `link:` 指向相邻的 `deepseek-harness` 源码 checkout；目录位置不同时需先调整开发链接，打包产物不依赖该路径。

在插件目录安装依赖并打包：

```sh
pnpm install
pnpm build
pnpm pack
```

从 DSH 源码目录安装打包产物：

```sh
pnpm dsh plugin --profile web add file:/绝对路径/dsh-git-sidebar-0.1.3.tgz
```

使用已安装的 DSH CLI 时去掉前面的 `pnpm`。重新启动对应 Web 服务后，打开会话右上角自带侧边栏，在引导页选择「源代码管理」。已有标签页时可通过标签栏的「+」回到引导页。

## 配置和安全

通过 profile 的 `cordis.patch.yml` 覆盖 `git-sidebar` 行的 `config.readLimit`，调整未跟踪文件的文本预览上限，默认 2 MiB。Git 操作走独立的 `/git-sidebar/api/*` 路由，保留 Host/Origin 浏览器请求检查、请求体大小限制、会话工作目录解析及危险操作确认。插件使用本机 Git，不改变用户的全局 Git 配置。

## 验证

`pnpm typecheck`、`pnpm test`（30 项）和 `pnpm build` 已通过。已在仅安装本插件的临时 profile 中检查原生侧边栏入口、Git 状态列表、文件差异和暂存操作；未执行用户仓库的提交、推送或丢弃操作。远端联网 push/fetch 未实测。

## 许可证

[MIT](LICENSE)
