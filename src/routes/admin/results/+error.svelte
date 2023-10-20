<script lang=ts>
  import SearchBar from '$lib/ui-components/SearchBar.svelte'
  import { page } from '$app/stores'
  import { appBase } from '$lib/util/globals'

</script>

<h1>Featured Search Results</h1>
<SearchBar target={`${appBase}/results`}/>
<div>
  <h2>{$page.error?.message ?? 'No Matching Results'}</h2>
  <p>Hmmm... We couldn't find any matches for "{$page.error?.message}".
     Double check your search spelling for errors or try different search terms.</p>
</div>

<style>

</style>
