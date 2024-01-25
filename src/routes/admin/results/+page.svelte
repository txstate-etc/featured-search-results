<script lang=ts>
  import SearchBar from '$lib/ui-components/SearchBar.svelte'
  import { DEFAULT_PAGINATION_SIZE, appBase } from '$lib/util/globals'
  import ResponsiveTable from '$lib/ui-components/responsive-table/ResponsiveTable.svelte'
  import type { Transforms, PropMeta, HeadingTexts, TableData, AsyncSortFunction, AsyncSortings } from '$lib/ui-components/responsive-table/ResponsiveTable.svelte'
  import { DateTime } from 'luxon'
  import type { AdvancedSearchResult, SortParam } from '$lib/util/helpers'
  import Pagination from '$lib/ui-components/Pagination.svelte'
  import { goto, invalidate } from '$app/navigation'

  /** @type {import('./$types').PageData} */
  export let data: AdvancedSearchResult & { reloadHandle: string } & { refresh: (options: { key: string, direction: 'asc' | 'desc' }[]) => Promise<TableData[]> }

  const propsMetas: PropMeta[] = [
    { key: 'title', type: 'string', sortable: true },
    { key: 'priority', type: 'number' },
    { key: 'keyphrase', type: 'string' },
    { key: 'mode', type: 'string' },
    { key: 'count', type: 'number' },
    { key: 'tags', type: 'string' },
    { key: 'brokensince', type: 'string', sortable: true }
  ]
  const headingTexts: HeadingTexts = {
    title: 'Page Name',
    brokensince: 'Broken',
    count: 'Hits',
    keyphrase: 'Terms',
    mode: 'Type'
  }
  const transforms: Transforms = {
    title: (value, record) => {
      return `<a href='${appBase}/results/${record.id}' target='_blank'>${value}</a><br>
      <a style='font-size: small;' href='${record.url}' target='_blank'>${record.url}</a>`
    },
    brokensince: (value, record) => {
      return DateTime.fromISO(value).toRelative() ?? ''
    },
    tags: (value, record) => {
      return `<div class='tags'>${value.map((tag: string) => {
        return `<div class='tag'><a href='${appBase}/results?q=tags=${tag}' target='_blank'>${tag}</a></div>`
      }).join('')}</div>`
    }
  }
  async function fullSort (options: { field: string, direction: 'asc' | 'desc' }): Promise<TableData[]> {
    const URL = `${appBase}/results?q=${data.search}&p=${data.pagination?.page ?? 0}&n=${data.pagination?.size ?? DEFAULT_PAGINATION_SIZE}&s=${JSON.stringify([options])}`
    await invalidate(data.reloadHandle)
    await goto(URL)
    return data.matches
  }
  const asyncSortings: AsyncSortings = {
    title: fullSort,
    /* tags: async (options: { field: string, direction?: 'asc' | 'desc' }): Promise<TableData[]> => {
      return await fullSort({ field: 'tagcount', direction: options.direction ?? 'asc' })
    }, */
    brokensince: fullSort
  }

  function getRowspanKeys (data: Record<string, any>[]) {
    return ['title', 'brokensince', 'tags', 'id', 'url']
  }

  const defaultSorts: SortParam[] = [{ field: 'title', direction: 'asc' }]
  $:pagesize = data.pagination?.size ?? DEFAULT_PAGINATION_SIZE
  $:page = data.pagination?.page ?? 0
  $:sorts = data.pagination?.sorts ?? defaultSorts
  $:sortedOn = data.pagination?.sorts.length ? data.pagination.sorts : defaultSorts
</script>

<h1>Featured Search Results</h1>
<SearchBar target={`${appBase}/results`} bind:search={data.search} reloadHandle={data.reloadHandle} {pagesize} {page} {sorts}/>
<a class='advanced-search-link' href={`${appBase}/guides/advanced-search`} target='_blank'>Advanced Search Guide</a>
{#if data.matches?.length}
  <div class='results-root-container'>
    <Pagination target={`${appBase}/results`} search={data.search} bind:pagesize bind:page {sorts} total={data.total}>
      <ResponsiveTable data={data.matches} {propsMetas} {transforms} {headingTexts} spanning={true} {getRowspanKeys} {asyncSortings} {sortedOn}/>
    </Pagination>
  </div>
{:else}
  <p>Hmmm... We couldn't find any matches for "{data.search ?? ''}".<br/>
  Double check your search for spelling errors or try different search terms.</p>
{/if}

<style>
  :global(tbody > tr > td) {
    /* Limit the width of the Page Name column. */
    max-width: 14rem;
    overflow-wrap: break-word;
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
