<script lang=ts>
  import SearchBar from '$lib/ui-components/SearchBar.svelte'
  import { appBase } from '$lib/util/globals'
</script>

<h1>Search Featured Results</h1>
<SearchBar target={`${appBase}/results`}/>
<a href={`${appBase}/results`}>Browse All Results</a>
<a class='advanced-search-link' href={`${appBase}/guides/advanced-search`} target='_blank'>Advanced Search Guide</a>
<!-- TODO: Potentially add other links to things such as top: xyz Results(of props) | Queries(of props) . -->

<style>
  a {
    font-size:small;
    position:relative;
    top: var(--margin-below-labels)
  }
  .advanced-search-link {
    margin-left: var(--element-container-spacing)
  }
</style>
