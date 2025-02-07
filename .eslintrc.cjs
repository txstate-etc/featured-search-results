module.exports = {
	root: true,
	extends: ['plugin:svelte/base', 'standard-with-typescript'],
	parser: '@typescript-eslint/parser',
	plugins: ['@typescript-eslint'],
	ignorePatterns: ['*.cjs', 'package/**/*', '*.config.js', '*.d.ts'],
  rules: {
    'import/first': 'off',
		'no-multiple-empty-lines': 'off',
    'no-undef-init': 'off',
		'no-unused-vars': 'off',
		'no-use-before-define': 'off',
		'no-void': 'off', // svelte problems
		'no-throw-literal': 'off', // svelte shorthand allows `throw error(number, { message: string })`
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/array-type': 'off',
		'@typescript-eslint/no-confusing-void-expression': 'off', // svelte problems
    '@typescript-eslint/no-non-null-assertion': 'off',
		'@typescript-eslint/no-throw-literal': 'off', // svelte shorthand allows `throw error(number, { message: string })`
		'@typescript-eslint/no-unnecessary-boolean-literal-compare': ['off'],
    '@typescript-eslint/no-unused-vars': 'off', // typescript does this better
    '@typescript-eslint/no-unsafe-argument': 'off', // typescript does this better
		'@typescript-eslint/no-use-before-define': 'off', // svelte problems
    "@typescript-eslint/prefer-nullish-coalescing": ["off"],
    '@typescript-eslint/prefer-readonly': ['off'],
    '@typescript-eslint/require-await': 'off',
    '@typescript-eslint/return-await': ['error', 'always'],
    '@typescript-eslint/strict-boolean-expressions': 'off'
  },
	parserOptions: {
		sourceType: 'module',
		ecmaVersion: 2020,
		extraFileExtensions: ['.svelte']
	},
	env: {
		browser: true,
		es2017: true,
		node: true
	},
	overrides: [
		{
			files: ['*.svelte'],
			parser: 'svelte-eslint-parser',
			parserOptions: {
				parser: '@typescript-eslint/parser'
			}
		}
	]
};
