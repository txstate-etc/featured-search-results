<script lang=ts>
  import SearchBar from '$lib/ui-components/SearchBar.svelte'
  import { appBase } from '$lib/util/globals'

</script>

<h1>Search Featured Results</h1>
<div>
  <SearchBar target={`${appBase}/results`}/>
  <a href={`${appBase}/results`}>Browse All Results</a>
</div>

<style>
  a {
    font-size:small;
    color: #000;
  }
</style>
