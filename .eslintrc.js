module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: './tsconfig.json'
  },
  plugins: [
    '@typescript-eslint'
  ],
  extends: [
    'airbnb-typescript/base',
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking'
  ],
  rules: {
    'lines-between-class-members': ['error', 'always', { 'exceptAfterSingleLine': true }],
    'arrow-parens': ['error', 'always'],
    'comma-dangle': ['error', 'never'],
    'class-methods-use-this': 'off',
    'import/no-unresolved': ['off'],
    'linebreak-style': 'off',
    'max-len': ['error', { 'code': 150 }],
    'no-console': 'off',
    'no-param-reassign': ['error', { 'props': false }],
    'no-plusplus': 'off',
    'object-curly-newline': ['error', { 'multiline': true }],
    'padded-blocks': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-use-before-define': 'off',
    'indent': 'off',
    '@typescript-eslint/indent': 'off',
    'camelcase': 'off',
    '@typescript-eslint/camelcase': 'off',
    'function-paren-newline': 'off',
    'no-underscore-dangle': 'off',
    '@typescript-eslint/no-unused-vars': ["error", { "argsIgnorePattern": "^_" }]
  },
  overrides: [
    {
      'files': ['**/*.spec.ts'],
      'rules': {
        '@typescript-eslint/unbound-method': 'off', // Complains about expect(instance.method)...
        'padded-blocks': 'off', // I like padding my describe blocks
      }
    }
  ]
};
