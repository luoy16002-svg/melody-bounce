import js from '@eslint/js';
import tseslint from 'typescript-eslint';
export default tseslint.config(
  { ignores: ['dist/**', 'site/dist/**', 'cards/dist/**', 'node_modules/**', '.cache/**', '.tmp/**', 'test/output/**', 'test/reference/compositions/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { files: ['**/*.ts', '**/*.tsx'], rules: { '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }] } },
  { files: ['site/scripts/**/*.mjs', 'site/content/**/*.mjs', 'cards/scripts/**/*.mjs'], languageOptions: { globals: { URL: 'readonly', console: 'readonly', process: 'readonly' } } }
);
