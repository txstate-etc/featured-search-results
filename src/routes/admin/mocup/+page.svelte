<script lang=ts>
  import SearchBar from '$lib/ui-components/SearchBar.svelte'
  import type { ResultDocument } from '$lib/models/result'
  import { appBase, type SearchResponse } from '$lib/util/globals'
  import ResponsiveTable from '$lib/ui-components/responsive-table/ResponsiveTable.svelte'
  import type { Transforms, PropMeta, HeadingTexts, Sortings } from '$lib/ui-components/responsive-table/ResponsiveTable.svelte'
  import { DateTime } from 'luxon'
  import { isNotBlank } from 'txstate-utils'

  /** @type {import('./$types').PageData} */
  export let data: SearchResponse<ResultDocument> & { transform?: string }

  const propsMetas: PropMeta[] = [
    { key: 'title', type: 'string', shouldNest: false },
    { key: 'priority', type: 'number', shouldNest: false },
    { key: 'keyphrase', type: 'string', shouldNest: false },
    { key: 'mode', type: 'string', shouldNest: false },
    { key: 'count', type: 'number', shouldNest: false },
    { key: 'tags', type: 'string', shouldNest: false },
    { key: 'brokensince', type: 'string', shouldNest: false }
  ]
  const headingTexts: HeadingTexts = {
    title: 'Page Name',
    brokensince: 'Broken',
    count: 'Hits',
    keyphrase: 'Match Words',
    mode: 'Type'
  }
  const transforms: Transforms = {
    title: (value, record) => {
      return `<a href='${appBase}/results/${record.id}'>${value}</a><br>
      <a style='font-size: small;' href='${record.url}'>${record.url}</a>`
    },
    brokensince: (value, record) => {
      return DateTime.fromISO(value).toRelative() ?? ''
    },
    tags: (value, record) => {
      return `<div class='tags'>${value.map((tag: string) => {
        return `<div class='tag'><a href='${appBase}/results?q=${tag}'>${tag}</a></div>`
      }).join('')}</div>`
    }
  }
  const sortings: Sortings = {
  /* TODO: Fix sorting so that entries sub-sort before passing to interpollator.
    priority: async (options: {key: string, direction: 'asc' | 'desc'}): Promise<TableData[]> => {
      return data = await fetch(`${apiBase}/results/${data.query}/entries.priority/${direction}`)
    } */
    // const aHighest = a.reduce((y: any, z: any) => Math.max(y, z.priority), -1000)
    // const bHighest = b.reduce((y: any, z: any) => Math.max(y, z.priority), -1000)
    // return aHighest - bHighest
  }

  function getRowspanKeys (data: Record<string, any>[]) {
    return ['title', 'brokensince', 'tags', 'id', 'url']
  }
  function normalizeQueryForArea (query: string | undefined, transform: string | undefined) {
    if (!query) return '{\r}'
    if (transform) return transform
    if (isNotBlank(data.query)) {
      return data.query.startsWith('{') ? data.query : `{${data.query}}`
    }
    return '{\r}'
  }
  function normalizeQueryForSearchBar (query: string | undefined) {
    if (!query) return ''
    if (isNotBlank(data.query)) {
      return data.query.startsWith('{') ? '' : data.query
    }
    return ''
  }
</script>

<h1>Moc-Up Testing</h1>
<form name='FilterInput' action={`${appBase}/mocup`} method='GET'>
  <div class='jsonsearch'>
    <textarea name='q' placeholder='Filter...' rows='30' cols='100'>{normalizeQueryForArea(data.query, data.transform)}</textarea>
    <button type='submit' class='submit-button'>Search</button>
  </div>
</form>
<SearchBar target={`${appBase}/mocup`} search={normalizeQueryForSearchBar(data.query)}/>
{#if data.results && data.results.length > 0}
  <div class='results-root-container'>
    <ResponsiveTable data={data.results} {propsMetas} {transforms} {headingTexts} spanning={true} {getRowspanKeys} />
  </div>
{:else}
  <p>Hmmm... We couldn't find any matches for "{data.query ?? ''}".<br/>
  Double check your search for spelling errors or try different search terms.</p>
{/if}
<!-- Stubbing a pagination concept. May put this in the respective lists instead of here.
<Pagination>
  <ResultList {data}/>
</Pagination>
-->

<style>
  .results-root-container {
    margin-top: var(--element-container-spacing);
    margin-bottom: var(--element-container-spacing);
  }
  :global(.tags) {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
  }
  :global(.tag) {
    margin-right: 0.3rem;
    font-size: small;
  }
</style>
