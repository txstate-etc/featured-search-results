import { base } from '$app/paths'
// The context of `dynamic` here is that the service is built but the landscape specific
// environment variables are different so they're loaded "dynamically" from environment.
import { env } from '$env/dynamic/public'
import { isNotBlank } from 'txstate-utils'
// The context of `building` here is the build step vs. the runtime step. While building
// our variables from `env` above won't be available as those are supplied by the runtime.
import { building } from '$app/environment'

export interface ClientAuth { login?: string, isEditor?: boolean }

export const PUBLIC_AUTH_REDIRECT_URL = !building
  ? `${env.PUBLIC_AUTH_BASE_URL!}/login?clientId=${env.PUBLIC_AUTH_CLIENT_ID ?? 'search-featured-results'}`
  : ''
const BASE_URL = !building
  ? `${env.PUBLIC_BASE_URL}${isNotBlank(base) ? '/' + base : ''}`
  : ''
export const appBase: string = `${base}/admin`
export const apiBase: string = base
export const apiURL: string = BASE_URL
export const appURL: string = `${BASE_URL}/admin`

export const DEFAULT_PAGINATION_SIZE: number = 100
export const DEFAULT_PAGESIZE_OPTIONS: { value: number }[] = [{ value: 10 }, { value: 20 }, { value: 50 }, { value: 100 }, { value: 200 }]

export const VALIDATE_ONLY = 'validateonly'
