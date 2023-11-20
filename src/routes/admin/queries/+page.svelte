<script lang=ts>
  import SearchBar from '$lib/ui-components/SearchBar.svelte'
  import type { ResultBasicPlusId } from '$lib/models/result'
  import { appBase } from '$lib/util/globals'
  import ResponsiveTable from '$lib/ui-components/responsive-table/ResponsiveTable.svelte'

  /* TODO:
    Run queries against the api to generate queries to search for.
  */
  /** @type {import('./$types').PageData} */
  export let data: { query: string, results: ResultBasicPlusId[] | undefined }
</script>

<h1>Visitor Queries</h1>
<SearchBar target={`${appBase}/queries`} search={data.query}/>
{#if data.results && data.results.length > 0}
  <div class='results-root-container'>
    <ResponsiveTable data={data.results} />
  </div>
{:else}
  <p>Hmmm... We couldn't find any matches for "{data.query}".<br/>
  Double check your search spelling for errors or try different search terms.</p>
{/if}
<!-- Stubbing a pagination concept.
<Pagination>
  <ResultList {data}/>
</Pagination>
-->

<style>

</style>
