# テンプレートカスタマイズガイド

[nextjs-i18n-themes-ssr-template](https://github.com/nakamura196/nextjs-i18n-themes-ssr-template) をベースにプロジェクトを作成する際に修正すべきファイルの一覧です。

## 必須の修正箇所

### 1. package.json

プロジェクト名を変更します。

```json
{
  "name": "your-project-name",  // ← 変更
  ...
}
```

**ファイル**: `package.json`

---

### 2. サイトメタデータ

サイト名、説明文、OGP画像、SNSアカウントを設定します。

```typescript
export const SITE_CONFIG = {
  name: {
    ja: 'あなたのサイト名',      // ← 変更
    en: 'Your Site Name',        // ← 変更
  },
  description: {
    ja: 'サイトの説明文',        // ← 変更
    en: 'Site description',      // ← 変更
  },
  url: process.env.NEXT_PUBLIC_SITE_URL || 'https://your-domain.com',
  ogImage: {
    ja: '/ogp-ja.svg',           // ← 必要に応じて変更
    en: '/ogp-en.svg',           // ← 必要に応じて変更
  },
  twitter: {
    card: 'summary_large_image',
    site: '@yoursite',           // ← 変更
    creator: '@yourcreator',     // ← 変更
  },
} as const;
```

**ファイル**: `src/constants/metadata.ts`

---

### 3. 翻訳ファイル（日本語）

サイト全体で使用されるテキストを変更します。

```json
{
  "Common": {
    "title": "あなたのサイト名",
    "description": "サイトの説明文",
    "home": "ホーム"
  },
  "Footer": {
    "copyright": "© 2024 Your Company"
  },
  ...
}
```

**ファイル**: `src/messages/ja.json`

---

### 4. 翻訳ファイル（英語）

```json
{
  "Common": {
    "title": "Your Site Name",
    "description": "Site description",
    "home": "Home"
  },
  "Footer": {
    "copyright": "© 2024 Your Company"
  },
  ...
}
```

**ファイル**: `src/messages/en.json`

---

### 5. 環境変数

```env
NEXT_PUBLIC_SITE_URL=https://genji-x.ldas.jp

# 秘密が要る値を足すときは、実値を書かず 1Password の参照を書く
#   SOME_TOKEN=op://Personal/<item-name>/<field>
# 読み込みは `op run --env-file=.env.local -- npm run dev` で行う
```

**ファイル**: `.env.local`（実際の値）、`.env.example`（サンプル）

---

### 6. README.md

プロジェクトの説明に書き換えます。

**ファイル**: `README.md`

---

### 7. CONTRIBUTING.md

プロジェクト名を変更します。

```markdown
# Contributing to Your Project Name
```

**ファイル**: `CONTRIBUTING.md`

---

## 任意の修正箇所

### 8. フッターのリンク

外部リンクをプロジェクトに関連するものに変更します。

```tsx
// 変更前
<a href="https://nextjs.org">Next.js</a>
<a href="https://next-intl.dev">next-intl</a>

// 変更後（例）
<a href="https://sketchfab.com">Sketchfab</a>
<a href="https://threejs.org">Three.js</a>
```

**ファイル**: `src/components/layout/Footer.tsx`

---

### 9. ヒーローセクションの背景画像

デフォルトのUnsplash画像を変更します。

```tsx
backgroundImage: 'url(https://your-image-url.com/image.jpg)',
```

**ファイル**: `src/components/page/home/Hero.tsx`

---

### 10. OGP画像

`public/` ディレクトリにOGP画像を配置します。

- `public/ogp-ja.svg` または `public/ogp-ja.png`
- `public/ogp-en.svg` または `public/ogp-en.png`

---

### 11. ファビコン

```
public/favicon.ico
```

---

### 12. 不要なページの削除

テンプレートに含まれる以下のページは、必要に応じて削除します。

- `src/app/[locale]/about/` - Aboutページ
- `src/app/[locale]/example/` - サンプルページ
- `src/components/page/example/` - サンプルページのコンポーネント

---

### 13. 不要なドキュメントの削除

テンプレートのドキュメントを削除します。

```
docs/blog/nextjs-i18n-themes-ssr-template.md
docs/blog/nextjs-sitemap-with-static-export.md
```

---

## チェックリスト

| ファイル | 修正内容 | 必須 |
|----------|----------|------|
| `package.json` | プロジェクト名 | ✅ |
| `src/constants/metadata.ts` | サイト名、説明、SNS | ✅ |
| `src/messages/ja.json` | 日本語テキスト | ✅ |
| `src/messages/en.json` | 英語テキスト | ✅ |
| `.env.local` | 環境変数 | ✅ |
| `.env.example` | 環境変数サンプル | ✅ |
| `README.md` | プロジェクト説明 | ✅ |
| `CONTRIBUTING.md` | プロジェクト名 | - |
| `src/components/layout/Footer.tsx` | 外部リンク | - |
| `src/components/page/home/Hero.tsx` | 背景画像 | - |
| `public/ogp-*.svg` | OGP画像 | - |
| `public/favicon.ico` | ファビコン | - |

---

## 参考：今回のプロジェクトでの変更例

今回のSketchfab GLB Viewerプロジェクトでは、以下の変更を行いました。

1. **package.json**: `"name": "sketchfab-glb-viewer"`
2. **metadata.ts**: サイト名を「Sketchfab GLB Viewer」に変更
3. **翻訳ファイル**: Sketchfab関連のテキストに変更
4. **.env.local**: `SKETCHFAB_API_TOKEN` を追加
5. **README.md**: プロジェクトの説明に書き換え
6. **新規ページ追加**: `src/app/[locale]/viewer/` にビューワーページを作成
7. **新規API追加**: `src/app/api/sketchfab/` にAPIルートを作成
8. **新規コンポーネント追加**: `src/components/GLBViewer.tsx` を作成
