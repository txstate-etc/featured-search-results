<script lang=ts>
  import SearchBar from '$lib/ui-components/SearchBar.svelte'
  import { appBase } from '$lib/util/globals'

</script>

<h1>Search Featured Results</h1>
<SearchBar target={`${appBase}/results`}/>
<a href={`${appBase}/results`}>Browse All Results</a>

<style>
  a {
    font-size:small;
    /* color: ; */
  }
</style>
