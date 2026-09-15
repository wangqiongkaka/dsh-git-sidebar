# dsh-git-sidebar

为 DSH 自带的右侧边栏提供 Git 源代码管理面板，在会话中查看变更、提交、同步分支和浏览提交历史。

## 功能

- 变更列表：所有改动在一个列表里，勾选即 Add，取消勾选即取消 Add；状态字母按类型着色；悬停行可查看差异或放弃该文件的更改。
- 同步：顶栏「同步」按钮先 Fetch，有未推送提交时接着 Push，按钮上显示未推送数量。
- 更多操作菜单：按远端 / 分支 / 工作区分组，收纳 Fetch All、推送、合并、变基、Worktree、全部 Add、存入 Stash、新建 Tag、放弃所有更改和刷新。
- 提交：多行提交信息输入，Ctrl+Enter 提交，按钮旁提示将提交的文件数。
- 历史图谱：显示所有分支的提交，左侧轨道图按分支着色，分支标签同色；分页加载。
- 提交右键菜单：打开更改、签出分支或分离 HEAD、创建 / 删除分支、创建 Tag、捡取、还原、与远程比较、与合并基础比较、任选两个提交比较、复制哈希或提交信息、把提交发送到当前会话聊天或请求解释更改。
- Stash 与 Tag：默认折叠只显示数量，展开后可 Pop / Apply / Drop 和推送、删除 Tag。
- Worktree：创建、打开对应 DSH 会话、合并和删除。
- 自动刷新：面板可见时每 5 秒静默重读状态，窗口获焦或标签页切回前台时立即刷新。
- 每个区域独立滚动并限制最大高度，提交框固定在面板底部。

差异按会话、文件、提交或提交区间分别打开标签页，布局与分屏由 DSH 管理；文件通过 DSH 文件预览器打开。远端操作使用本机已有的 Git 认证和身份。

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
pnpm dsh plugin --profile web add file:/绝对路径/dsh-git-sidebar-0.1.4.tgz
```

使用已安装的 DSH CLI 时去掉前面的 `pnpm`。重新启动对应 Web 服务后，关闭旧标签页，重新打开终端打印的 URL，在引导页选择「源代码管理」。已有标签页时可通过标签栏的「+」回到引导页。

同一版本号重新打包后，`plugin add` 会复用 pnpm 缓存而不更新文件，需先执行 `plugin --profile web remove dsh-git-sidebar` 再 add。

## 配置和安全

通过 profile 的 `cordis.patch.yml` 覆盖 `git-sidebar` 行的 `config.readLimit`，调整未跟踪文件的文本预览上限，默认 2 MiB。Git 操作走独立的 `/git-sidebar/api/*` 路由，保留 Host/Origin 浏览器请求检查、请求体大小限制、会话工作目录解析、参数注入校验及危险操作确认。删除分支只删已合并的分支。插件使用本机 Git，不改变用户的全局 Git 配置。

## 设计稿

界面以 Claude Design 画布为准：<https://claude.ai/code/artifact/129dd70a-3e87-48d8-8f90-a2e2f172bf16>，含主界面、工作区干净、提交右键菜单、更多操作菜单四块画板。开发约定见 `CLAUDE.md`。

## 验证

`pnpm typecheck`、`pnpm test`（33 项）和 `pnpm build` 已通过。已在本机 DSH web profile 中检查引导页入口、变更列表与勾选 Add、历史图谱、两组菜单、自动刷新；未执行用户仓库的推送或丢弃操作。「添加到聊天」「解释更改」依赖 DSH 会话接口，未实测发送。

## 许可证

[MIT](LICENSE)
