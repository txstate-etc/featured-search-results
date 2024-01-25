<script lang=ts>
  import SearchBar from '$lib/ui-components/SearchBar.svelte'
  import ResponsiveTable from '$lib/ui-components/responsive-table/ResponsiveTable.svelte'
  import type { Transforms, PropMeta, HeadingTexts, TableData, AsyncSortings } from '$lib/ui-components/responsive-table/ResponsiveTable.svelte'
  import { DEFAULT_PAGINATION_SIZE, appBase } from '$lib/util/globals'
  import type { ResultBasicPlusId } from '$lib/models/result'
  import { DateTime } from 'luxon'
  import { htmlEncode } from 'txstate-utils'
  import { querysplit, type AdvancedSearchResult, type SortParam } from '$lib/util/helpers'
  import Pagination from '$lib/ui-components/Pagination.svelte'
  import { goto, invalidate } from '$app/navigation'

  /* TODO: Run queries against the api to generate queries to search for.
    localhost/search?q=texas+state
    featured.search.qual.txstate.edu/search?q=bubba+hotep       */

  /** @type {import('./$types').PageData} */
  export let data: AdvancedSearchResult & { reloadHandle: string }

  const propsMetas: PropMeta[] = [
    { key: 'query', type: 'string', sortable: true },
    { key: 'hits', type: 'number', sortable: true },
    { key: 'lasthit', type: 'string', sortable: true },
    { key: 'results', type: 'string' }
  ]
  const headingTexts: HeadingTexts = {
    lasthit: 'Last Hit'
  }
  const sortedMapping: Record<string, string> = {
    hitcount: 'hits'
  }
  const transforms: Transforms = {
    results: (value, record) => {
      if (Array.isArray(value) && value.length > 0) {
        return value.map((result: ResultBasicPlusId) => {
          return `<div class='result'>
            <a href='${appBase}/results/${result.id}' target='_blank'>${result.title}</a><br>
            <a style='font-size: small;' href='${result.url}' target='_blank'>${result.url}</a>
            </div>`
        }).join('')
      }
      return `No results match this query. <button class='create-result-button' onclick=window.open('${appBase}/results/create?forQuery=${htmlEncode(querysplit(record.query).join('%20'))}','_blank')>Create Result</button>`
    },
    lasthit: (value, record) => {
      return DateTime.fromISO(value).toRelative() ?? ''
    },
    hits: (value, record) => {
      return value.toLocaleString()
    }
  }
  async function fullSort (options: { field: string, direction: 'asc' | 'desc' }): Promise<TableData[]> {
    const URL = `${appBase}/queries?q=${data.search}&p=${data.pagination?.page ?? 0}&n=${data.pagination?.size ?? DEFAULT_PAGINATION_SIZE}&s=${JSON.stringify([options])}`
    await invalidate(data.reloadHandle)
    await goto(URL)
    return data.matches
  }
  const asyncSortings: AsyncSortings = {
  /* TODO: Fix sorting so that entries sub-sort before passing to interpollator.
    priority: async (options: {key: string, direction: 'asc' | 'desc'}): Promise<TableData[]> => {
      return data = await fetch(`${apiBase}/results/${data.query}/entries.priority/${direction}`)
    } */
    query: fullSort,
    hits: async (options: { field: string, direction?: 'asc' | 'desc' }): Promise<TableData[]> => {
      return await fullSort({ field: 'hitcount', direction: options.direction ?? 'desc' })
    },
    lasthit: fullSort
  }

  const defaultSorts: SortParam[] = [{ field: 'hitcount', direction: 'desc' }]
  $:pagesize = data.pagination?.size ?? DEFAULT_PAGINATION_SIZE
  $:page = data.pagination?.page ?? 0
  $:sorts = data.pagination?.sorts ?? defaultSorts
  $:sortedOn = data.pagination?.sorts.length ? data.pagination.sorts : defaultSorts
</script>

<h1>Visitor Searches</h1>
<SearchBar target={`${appBase}/queries`} bind:search={data.search} reloadHandle={data.reloadHandle} {pagesize} {page} {sorts}/>
<a class='advanced-search-link' href={`${appBase}/guides/advanced-search`} target='_blank'>Advanced Search Guide</a>
{#if data.matches?.length}
  <div class='results-root-container'>
    <Pagination target={`${appBase}/queries`} search={data.search} bind:pagesize bind:page {sorts} total={data.total}>
      <ResponsiveTable data={data.matches} {propsMetas} {headingTexts} {transforms} {asyncSortings} {sortedOn} {sortedMapping}/>
    </Pagination>
  </div>
{:else}
  <p>Hmmm... We couldn't find any matches for "{data.search ?? ''}".<br/>
  Double check your search for spelling errors or try different search terms.</p>
{/if}

<style>
  :global(.create-result-button) {
    padding: 0.6rem;
    border: var(--submit-button-border);
    border-radius: var(--submit-button-radius);
    background-color: var(--dg-button-bg);
    color: var(--dg-button-text);
    cursor: pointer;
    align-items: center;
    line-height: 0.7;
  }
  .results-root-container {
    margin-top: var(--element-container-spacing);
    margin-bottom: var(--element-container-spacing);
    position: relative;
    top: -1rem;
  }
  .advanced-search-link {
    position:relative;
    top: var(--margin-below-labels)
  }
  :global(.result:not(:last-child)) {
    margin-bottom: 0.8rem;
  }
</style>
