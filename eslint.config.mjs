import next from 'eslint-config-next';

/**
 * ESLint flat config (ESLint 9 / Next.js 16).
 * `eslint-config-next` already bundles `next/core-web-vitals`,
 * `next/typescript` and a sensible `ignores` block, so we just
 * spread it and layer project-specific overrides on top.
 */
const eslintConfig = [
  // .open-next は OpenNext が生成する Worker の束ね。他人のコードなので見ない
  { ignores: ['.next/**', 'out/**', 'build/**', '.open-next/**', '.wrangler/**'] },
  ...next,
  {
    rules: {
      '@next/next/no-img-element': 'off',
    },
  },
];

export default eslintConfig;
