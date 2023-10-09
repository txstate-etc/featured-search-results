// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			login?: string
			/** Boolean - Result of request hooks determining if this request is from someone allowed to manage SFRs. */
			isEditor?: boolean
		}
		// interface PageData {}
		// interface Platform {}
	}
}

export {};
