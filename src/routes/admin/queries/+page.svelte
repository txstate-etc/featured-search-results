<script lang=ts>
  import SearchBar from '$lib/ui-components/SearchBar.svelte'
  import ResponsiveTable, { type Transforms } from '$lib/ui-components/responsive-table/ResponsiveTable.svelte'
  import { appBase } from '$lib/util/globals'
  import type { QueryBasic } from '$lib/models/query'
  import type { ResultBasicPlusId } from '$lib/models/result'

  /* TODO: Run queries against the api to generate queries to search for.
    localhost/search?q=texas+state
    featured.search.qual.txstate.edu/search?q=bubba+hotep       */

  /** @type {import('./$types').PageData} */
  export let data: { query: string, results: QueryBasic[] | undefined }

  const transforms: Transforms = {
    results: (value, record) => {
      if (Array.isArray(value) && value.length > 0) {
        return value.map((result: ResultBasicPlusId) => {
          return `<div class='result'>
            <a href='${appBase}/results/${result.id}'>${result.title}</a><br>
            <a style='font-size: small;' href='${result.url}'>${result.url}</a>
            </div>`
        }).join('')
      }
      return ''
    }
  }
</script>

<h1>Visitor Queries</h1>
<SearchBar target={`${appBase}/queries`} search={data.query}/>
{#if data.results && data.results.length > 0}
  <div class='results-root-container'>
    <ResponsiveTable data={data.results} {transforms}/>
  </div>
{:else}
  <p>Hmmm... We couldn't find any matches for "{data.query ?? ''}".<br/>
  Double check your search spelling for errors or try different search terms.</p>
{/if}
<!-- Stubbing a pagination concept.
<Pagination>
  <ResultList {data}/>
</Pagination>
-->

<style>
  .results-root-container {
    margin-top: var(--element-container-spacing);
    margin-bottom: var(--element-container-spacing);
  }
  :global(.result:not(:last-child)) {
    margin-bottom: 0.8rem;
  }
</style>
