<script lang=ts>
  import SearchBar from '$lib/ui-components/SearchBar.svelte'
  import ResultList from '$lib/ui-components/ResultList.svelte'
  import type { ResultBasicPlusId } from '$lib/models/result'
  import { appBase } from '$lib/util/globals'

  /** @type {import('./$types').PageData} */
  export let data: ResultBasicPlusId[]
</script>

<h1>Visitor Queries</h1>
<SearchBar target={`${appBase}/queries`}/>
<ResultList {data}/>
<!-- Stubbing a pagination concept.
<Pagination>
  <ResultList {data}/>
</Pagination>
-->

<style>

</style>
