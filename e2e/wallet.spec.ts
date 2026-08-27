/**
 * ウォレット。**MetaMask が無い環境でも壊れないこと**が主眼。
 * 署名そのものは実際のウォレットが要るので、ここでは扱わない。
 */
import { test, expect } from '@playwright/test';

test('ウォレットが無い環境でも表示が壊れない', async ({ page }) => {
  await page.goto('/ja');
  const header = page.locator('header').first();
  await expect(header.getByText(/ウォレット/)).toBeVisible();
  // 「未検出」でもクリックで壊れないこと
  await expect(page.locator('text=Unhandled Runtime Error')).toHaveCount(0);
});

test('注入されたウォレットを検出する', async ({ page }) => {
  // window.ethereum を差し込んで、接続ボタンが出ることを確かめる
  await page.addInitScript(() => {
    (window as unknown as { ethereum: unknown }).ethereum = {
      request: async ({ method }: { method: string }) => {
        if (method === 'eth_accounts') return [];
        if (method === 'eth_chainId') return '0xaa36a7';
        if (method === 'eth_requestAccounts') return ['0x' + '1'.repeat(40)];
        return null;
      },
      on: () => {}, removeListener: () => {},
    };
  });
  await page.goto('/ja');
  await expect(page.getByRole('button', { name: /ウォレットを接続/ })).toBeVisible();
});

test('接続済みならアドレスが縮めて出る', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { ethereum: unknown }).ethereum = {
      request: async ({ method }: { method: string }) => {
        if (method === 'eth_accounts') return ['0xA787b1285d7D0Cf5284167Ce278774371946A3aA'];
        if (method === 'eth_chainId') return '0xaa36a7';
        return null;
      },
      on: () => {}, removeListener: () => {},
    };
  });
  await page.goto('/ja');
  await expect(page.locator('header').first()).toContainText(/0xA787…A3aA|0xA787/i);
});

test('別のネットワークに繋いでいたら知らせる', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { ethereum: unknown }).ethereum = {
      request: async ({ method }: { method: string }) => {
        if (method === 'eth_accounts') return ['0xA787b1285d7D0Cf5284167Ce278774371946A3aA'];
        if (method === 'eth_chainId') return '0x1'; // mainnet
        return null;
      },
      on: () => {}, removeListener: () => {},
    };
  });
  await page.goto('/ja');
  await expect(page.locator('header').first()).toContainText(/Sepolia に切り替え/);
});

test.describe('接続を解く', () => {
  /** 接続済みのウォレットを装う。許可の返上に対応する版 */
  const stub = (revokes: boolean) => `
    let revoked = false;
    window.__revoked = false;
    window.ethereum = {
      request: async ({method}) => {
        if (revoked && method === 'eth_accounts') return [];
        if (method === 'eth_accounts' || method === 'eth_requestAccounts')
          return ['0xA787b1285d7D0Cf5284167Ce278774371946A3aA'];
        if (method === 'eth_chainId') return '0xaa36a7';
        if (method === 'wallet_revokePermissions') {
          ${revokes ? 'revoked = true; window.__revoked = true; return null;'
                    : 'throw new Error("Unsupported method");'}
        }
        return null;
      },
      on(){}, removeListener(){},
    };`;

  test('繋いだあと、吹き出しに 3 つ並ぶ', async ({ page }) => {
    await page.addInitScript(stub(true));
    await page.goto('/ja');
    const btn = page.locator('[aria-label="Account"]');
    await expect(btn).toHaveAttribute('aria-expanded', 'false');
    await btn.click();
    const menu = page.locator('[role="menu"]');
    await expect(menu).toBeVisible();
    // 住所・コピー・Explorer・接続を解く（本家 Details.tsx の下半分）
    await expect(menu).toContainText('0xA787b1285d7D0Cf5284167Ce278774371946A3aA');
    await expect(menu.getByRole('button', { name: /コピー/ })).toBeVisible();
    await expect(menu.getByRole('link', { name: /Etherscan/ })).toBeVisible();
    await expect(menu.getByRole('button', { name: /接続を解く/ })).toBeVisible();
  });

  test('押すと、許可の返上を試して表示も戻る', async ({ page }) => {
    await page.addInitScript(stub(true));
    await page.goto('/ja');
    await page.locator('[aria-label="Account"]').click();
    await page.getByRole('button', { name: /接続を解く/ }).click();
    // ウォレット側にも返上を頼んでいること
    await expect.poll(() => page.evaluate(() => (window as never as {__revoked:boolean}).__revoked))
      .toBe(true);
    // 画面が「未接続」に戻ること
    await expect(page.getByRole('button', { name: /ウォレットを接続/ })).toBeVisible();
    await expect(page.locator('[role="menu"]')).toHaveCount(0);
  });

  test('許可の返上に対応していないウォレットでも、画面は必ず戻る', async ({ page }) => {
    /**
     * **これが肝心。** EIP-1193 に切断の口は無く、
     * `wallet_revokePermissions` は実験的な拡張でしかない。
     * 対応していないウォレットで「押したのに何も起きない」を残さない。
     */
    await page.addInitScript(stub(false));
    await page.goto('/ja');
    await page.locator('[aria-label="Account"]').click();
    await page.getByRole('button', { name: /接続を解く/ }).click();
    await expect(page.getByRole('button', { name: /ウォレットを接続/ })).toBeVisible();
  });

  test('外を押すと閉じる', async ({ page }) => {
    await page.addInitScript(stub(true));
    await page.goto('/ja');
    await page.locator('[aria-label="Account"]').click();
    await expect(page.locator('[role="menu"]')).toBeVisible();
    // 吹き出しの外なら何でもよい。h1 は画面幅で位置が動くので footer を押す
    await page.locator('footer').click({ position: { x: 5, y: 5 }, force: true });
    await expect(page.locator('[role="menu"]')).toHaveCount(0);
  });
});
