import type { TemplateResult } from '$lib/models/result.js'

/** @type {import('./$types').PageLoad} */
export async function load ({ url }) {
  const query = (url.searchParams.get('forQuery') ?? undefined)?.trim()
  const template: TemplateResult = { title: '', url: 'https://', entries: [{ keyphrase: query ?? '', mode: 'keyword', priority: 50, count: 0 }] }
  if (query) return { result: template }
  return { result: undefined }
}
