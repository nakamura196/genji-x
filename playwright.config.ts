/**
 * Playwright の設定。
 *
 * ── 何を守るためのテストか ──────────────────────────────────────
 * この試作の UI は、本家 (Ocean Market / Pontus-X / Clio-X) からの移植で成り立っている。
 * 移植は「見て書き直す」と必ずずれるので、**実際に踏んだ不具合を 1 つずつ固定する**。
 * 過去に踏んだもの:
 *   - 一覧のリンクに言語接頭辞が付かず /asset/01 になって 404
 *   - 内容の短いページでフッタが画面の途中に止まる
 *   - Clio-X が Footer に色を直書きしていて、暗い表示で白いまま残る
 *   - Tailwind v4 が node_modules を走査せず、部品のクラスが生成されない
 *   - メッセージに山括弧を書いて next-intl の ICU 解析が落ちる
 *   - サーバ部品からクライアント部品へ関数を渡してビルドが落ちる
 *
 * ── 開発サーバは自分で立てない ──────────────────────────────────
 * prebuild でチェーンを読むため、起動に時間がかかる。すでに :3000 で
 * 動いているものを使う。動いていなければ webServer が立ち上げる。
 */
import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.PORT ?? 3000);
const BASE = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : [['list']],
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'ja-JP',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { ...devices['iPhone 14'] } },
  ],
  webServer: {
    command: 'npx next dev --port ' + PORT,
    url: BASE + '/ja',
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
