import stylistic from '@stylistic/eslint-plugin'
import tslint from '@typescript-eslint/eslint-plugin'
import Parser from '@typescript-eslint/parser'
import { ESLint } from 'eslint'
import { defineConfig, globalIgnores } from 'eslint/config'
import importOrder from 'eslint-plugin-import'
import noRelativeImportPaths from 'eslint-plugin-no-relative-import-paths'

export default defineConfig([
  globalIgnores([
    './node_modules/*',
    './reports/*',
  ]),
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: Parser,
      parserOptions: {
        ecmaVersion: 2024,
        sourceType: 'module',
      },
    },
    plugins: {
      '@stylistic': stylistic,
      '@typescript-eslint': tslint as unknown as ESLint.Plugin,
      'no-relative-import-paths': noRelativeImportPaths,
      'import': importOrder,
    },
    rules: {
      ...tslint.configs['recommended']?.rules,

      'no-console': 'error',
      'no-unused-vars': 'off',
      'object-shorthand': ['error', 'never'],
      'prefer-const': 'error',

      '@stylistic/comma-dangle': ['error', 'always-multiline'],
      '@stylistic/eol-last': ['error', 'always'],
      '@stylistic/indent': ['error', 2],
      '@stylistic/no-multi-spaces': ['error'],
      '@stylistic/no-multiple-empty-lines': ['error', { max: 1, maxBOF: 0, maxEOF: 0 }],
      '@stylistic/no-trailing-spaces': ['error'],
      '@stylistic/object-curly-spacing': ['error', 'always'],
      '@stylistic/quotes': ['error', 'single'],
      '@stylistic/semi': ['error', 'never'],

      'no-relative-import-paths/no-relative-import-paths': ['error', {
        allowSameFolder: true,
        rootDir: 'src',
        prefix: '@app',
      }],

      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],

      'import/order': ['error', {
        groups: [
          'builtin',
          'external',
          'internal',
          ['parent', 'sibling'],
          'index',
          'object',
          'type',
        ],
        pathGroups: [{
          pattern: '@app/**',
          group: 'internal',
          position: 'before',
        }],
        pathGroupsExcludedImportTypes: ['builtin'],
        alphabetize: {
          order: 'asc',
          caseInsensitive: true,
        },
      }],
    },
  },
])
