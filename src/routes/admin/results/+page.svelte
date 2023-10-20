<script lang=ts>
  import SearchBar from '$lib/ui-components/SearchBar.svelte'
  import ResultList from '$lib/ui-components/ResultList.svelte'
  import type { ResultBasicPlusId } from '$lib/models/result'
  import { appBase } from '$lib/util/globals'

  /** @type {import('./$types').PageData} */
  export let data: ResultBasicPlusId[]
</script>

<h1>Featured Search Results</h1>
<SearchBar target={`${appBase}/results`}/>
<ResultList {data}/>
<!-- Stubbing a pagination concept. May put this in the respective lists instead of here.
<Pagination>
  <ResultList {data}/>
</Pagination>
-->

<style>

</style>
