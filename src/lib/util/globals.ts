import { base } from '$app/paths'

export const appBase: string = `${base}/admin`
export const apiBase: string = base

export const DEFAULT_PAGINATION_SIZE: number = 100
export const DEFAULT_PAGESIZE_OPTIONS: { value: number }[] = [{ value: 10 }, { value: 20 }, { value: 50 }, { value: 100 }, { value: 200 }]

// TODO: Need to figure out how to best pass css style colors.
