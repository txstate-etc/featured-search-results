import type { PlaywrightTestConfig } from '@playwright/test'

const config: PlaywrightTestConfig = {
	webServer: {
		command: 'while true; do sleep 600; done',
		url: 'http://search-featured-results'
	},
	use: {
		baseURL: 'http://search-featured-results'
	},
	testDir: 'tests',
	testMatch: /(.+\.)?(test|spec)\.[jt]s/
};

export default config
