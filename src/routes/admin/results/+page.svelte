<script lang=ts>
  import SearchBar from '$lib/ui-components/SearchBar.svelte'
  import type { ResultDocument } from '$lib/models/result'
  import { appBase } from '$lib/util/globals'
  import ResponsiveTable from '$lib/ui-components/responsive-table/ResponsiveTable.svelte'
  import type { Transforms, PropMeta, HeadingTexts, Sortings } from '$lib/ui-components/responsive-table/ResponsiveTable.svelte'
  import { DateTime } from 'luxon'

  /** @type {import('./$types').PageData} */
  export let data: { query: string, results: ResultDocument[] | undefined }

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
        return `<div class='tag'><a href='${appBase}/results?q=${tag}' target='_blank'>${tag}</a></div>`
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
</script>

<h1>Featured Search Results</h1>
<SearchBar target={`${appBase}/results`} search={data.query}/>
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
