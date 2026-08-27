/**
 * `/` に来た人を既定の言語へ送る。
 *
 * middleware を持たないので、振り分けはここで静的に行う。
 * Accept-Language は見ない（見るには実行時の処理が要る）。
 */
import { redirect } from 'next/navigation';
import { routing } from '@/i18n/routing';

export default function RootPage() {
  redirect(`/${routing.defaultLocale}`);
}
