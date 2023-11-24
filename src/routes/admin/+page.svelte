<script lang=ts>
  import SearchBar from '$lib/ui-components/SearchBar.svelte'
  import { appBase } from '$lib/util/globals'

</script>

<h1>Search Featured Results</h1>
<SearchBar target={`${appBase}/results`}/>
<a href={`${appBase}/results?q=`}>Browse All Results</a>
<!-- TODO: Potentially add other links to things such as top: xyz Results(of props) | Queries(of props) . -->

<style>
  a {
    font-size:small;
    /* color: ; */
  }
</style>
