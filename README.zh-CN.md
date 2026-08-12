# Serene

[![Astro](https://img.shields.io/badge/Astro-6.x-BC52EE?logo=astro)](https://astro.build) [![Tailwind](https://img.shields.io/badge/Tailwind-v4-06B6D4?logo=tailwindcss)](https://tailwindcss.com) [![Vercel](https://img.shields.io/github/deployments/yu030x/astro-theme-serene/production?style=flat&logo=vercel&label=vercel)](https://github.com/yu030x/astro-theme-serene/deployments) [![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

基于 **Astro** 的宁静编辑式博客主题：静态优先、系统字体、克制动效，以及适合长文阅读的窄阅读列。

[English](./README.md) | 简体中文 · **[在线演示 →](https://astro-theme-serene.vercel.app)**

![Serene 首页亮色](.github/assets/preview-home-light.png)

<details>
<summary>更多截图</summary>

![Serene 首页暗色](.github/assets/preview-home-dark.png)

![Serene 文章页](.github/assets/preview-article.png)
</details>

## 特性

- 编辑式博客页面：分类、标签、归档、RSS、站点地图、Open Graph 与 JSON-LD。
- 支持 Markdown、MDX、KaTeX 数学公式、旁注、代码高亮和 Callout。
- 以阅读为先：目录、阅读进度、图片放大、暗色模式和 reduced-motion 支持。
- Pagefind 静态搜索；Waline 评论、点赞和 GitHub 贡献图均为可选。
- 无需后端，构建后的 `dist/` 可部署到任意静态托管。

## 部署

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fyu030x%2Fastro-theme-serene)

## 快速开始

需要 [Node.js](https://nodejs.org/) **22.12+**。

```bash
git clone https://github.com/yu030x/astro-theme-serene.git my-blog
cd my-blog
npm install
npm run dev       # http://localhost:4321
```

| 命令 | 作用 |
|------|------|
| `npm run dev` | 本地开发与热更新 |
| `npm run check` | Astro 类型与模板检查 |
| `npm run build` | 静态构建并生成 Pagefind 索引 |
| `npm run preview` | 预览生产构建 |

## 自定义

从 [`src/site.config.ts`](src/site.config.ts) 开始：修改站点信息、作者 URL、导航、社交链接、文章许可证和可选服务。然后替换 `src/content/blog/`、`src/data/projects.json`、`src/data/links.json` 与 `src/data/tools.json` 中的示例内容。

`src/assets/tools/` 内置了一组可选图标，`tools.json` 的 `icon` 字段填该目录下的任意文件名即可；其中多数示例并未用到。也可以直接放入自己的 SVG。

界面文案固定为英文，不随 `locale` 变化，详见[多语言](#多语言)。

Waline 默认关闭。只有在填入自己的服务地址后再启用。

## 多语言

`site.config.ts` 中的 `locale` 与 `dateLocale` 只控制机器可读的部分：`<html lang>`、`og:locale`、JSON-LD 的 `inLanguage`、RSS 的 `<language>`，以及日期格式。

**它们不会翻译界面。** "Published"、"Reading"、"On this page"、"Back to top" 这类文案是直接写在组件里的英文，所以把 `locale` 改成 `zh-CN` 只会得到一个「声明为中文、界面却是英文」的页面——对读屏软件而言比不改更糟。要中文界面，需要直接修改 `src/components/` 和 `src/pages/` 下的文案，改完再同步 `locale`。

文章内容本身不受影响，用任何语言书写都可以。


## 目录结构

```text
astro-theme-serene/
├── .github/assets/      # README 预览截图
├── public/              # Favicon、头像、OG 图和友链图标
├── src/
│   ├── assets/          # 头像、文章图和工具图标
│   ├── components/      # 可复用界面组件
│   ├── content/blog/    # Markdown 与 MDX 文章
│   ├── data/            # 项目、友链与工具数据
│   ├── layouts/         # 页面外壳
│   ├── lib/             # 内容、日期和图片工具
│   ├── pages/           # Astro 路由
│   ├── plugins/         # Markdown/MDX 插件
│   ├── scripts/app.ts   # 客户端交互
│   ├── styles/global.css    # 设计令牌与组件样式
│   ├── content.config.ts    # 内容 Schema
│   └── site.config.ts   # 站点配置
├── astro.config.ts      # Astro 集成与 Vite 配置
├── package.json         # 脚本与依赖
├── tsconfig.json        # TypeScript 配置
├── CONTRIBUTING.md      # 贡献检查说明
└── LICENSE              # MIT 许可证
```

## 参与贡献

提交 PR 前运行 `npm run check` 和 `npm run build`。完整约定见 [`CONTRIBUTING.md`](CONTRIBUTING.md)。

## 致谢

视觉参考 [astro-theme-pure](https://github.com/cworld1/astro-theme-pure) 与 [Litos](https://github.com/Dnzzk2/Litos)。

## 许可证

[MIT](LICENSE)
