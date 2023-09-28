module.exports = {
	root: true,
	extends: ['plugin:svelte/base', 'standard-with-typescript'],
	parser: '@typescript-eslint/parser',
	plugins: ['@typescript-eslint'],
	ignorePatterns: ['*.cjs', 'package/**/*', '*.config.js', '*.d.ts'],
  rules: {
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/array-type': 'off',
    '@typescript-eslint/no-non-null-assertion': 'off',
    '@typescript-eslint/no-unused-vars': 'off', // typescript does this better
    '@typescript-eslint/no-throw-literal': 'off', // sveltekit error function
    '@typescript-eslint/require-await': 'off',
		'@typescript-eslint/prefer-nullish-coalescing': 'off', // not compatible with strictNullChecks disabled
    '@typescript-eslint/return-await': ['error', 'always'],
    '@typescript-eslint/strict-boolean-expressions': 'off',
    '@typescript-eslint/prefer-readonly': ['off']
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
