import { Link } from '@/i18n/routing';
import { useTranslations } from 'next-intl';

type BreadcrumbItem = { title: string; href?: string };

export default function PageLayout({
  title,
  description,
  breadcrumbItems,
  children,
  fluid = false,
}: {
  title: string;
  description?: string;
  breadcrumbItems: BreadcrumbItem[];
  children: React.ReactNode;
  fluid?: boolean;
}) {
  const t = useTranslations('Common');

  return (
    <div>
      {/* パンくずリスト */}
      <div className="container mx-auto px-4 py-8 md:py-12">
        <nav
          aria-label="Breadcrumb"
          className="mb-6 md:mb-8 text-sm text-gray-500 dark:text-gray-400"
        >
          <Link href={`/`} className="hover:text-gray-700 dark:hover:text-gray-200">
            {t('home')}
          </Link>

          {breadcrumbItems.map((item, i) => (
            <span key={i}>
              <span className="mx-2 text-gray-400 dark:text-gray-500">›</span>
              {item.href ? (
                <Link href={item.href} className="hover:text-gray-700 dark:hover:text-gray-200">
                  {item.title}
                </Link>
              ) : (
                <span className="text-gray-700 dark:text-gray-300">{item.title}</span>
              )}
            </span>
          ))}
        </nav>
      </div>

      <article>
        <div className="container mx-auto px-4">
          {/* 記事ヘッダー */}
          <header className="mb-8 md:mb-12">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4 md:mb-6">
              {title}
            </h1>
            {description && (
              <p className="text-gray-600 dark:text-gray-300 mb-4 md:mb-6">{description}</p>
            )}
          </header>
        </div>
        <div
          className={`
            px-4 py-8 md:py-12
            ${fluid ? 'max-w-full' : 'container mx-auto'}
          `}
        >
          {children}
        </div>
      </article>
    </div>
  );
}
