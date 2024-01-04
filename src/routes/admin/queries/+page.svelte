<script lang=ts>
  import SearchBar from '$lib/ui-components/SearchBar.svelte'
  import ResponsiveTable from '$lib/ui-components/responsive-table/ResponsiveTable.svelte'
  import type { Transforms, PropMeta, HeadingTexts, Sortings } from '$lib/ui-components/responsive-table/ResponsiveTable.svelte'
  import { appBase } from '$lib/util/globals'
  import type { QueryBasic } from '$lib/models/query'
  import type { ResultBasicPlusId } from '$lib/models/result'
  import { DateTime } from 'luxon'
  import { htmlEncode } from 'txstate-utils'
  import { querysplit } from '$lib/util/helpers'

  /* TODO: Run queries against the api to generate queries to search for.
    localhost/search?q=texas+state
    featured.search.qual.txstate.edu/search?q=bubba+hotep       */

  /** @type {import('./$types').PageData} */
  export let data: { query: string, results: QueryBasic[] | undefined, reloadHandle: string }

  const propsMetas: PropMeta[] = [
    { key: 'query', type: 'string', sortable: true },
    { key: 'hits', type: 'number', sortable: true },
    { key: 'lasthit', type: 'string', sortable: true },
    { key: 'results', type: 'string' }
  ]
  const headingTexts: HeadingTexts = {
    lasthit: 'Last Hit'
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
    }
  }
</script>

<h1>Visitor Searches</h1>
<SearchBar target={`${appBase}/queries`} search={data.query} reloadHandle={data.reloadHandle}/>
{#if data.results?.length}
  <div class='results-root-container'>
    <ResponsiveTable data={data.results} {propsMetas} {headingTexts} {transforms}/>
  </div>
{:else}
  <p>Hmmm... We couldn't find any matches for "{data.query ?? ''}".<br/>
  Double check your search for spelling errors or try different search terms.</p>
{/if}
<!-- Stubbing a pagination concept.
<Pagination>
  <ResultList {data}/>
</Pagination>
-->

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
  }
  :global(.result:not(:last-child)) {
    margin-bottom: 0.8rem;
  }
</style>
