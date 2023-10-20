<script lang=ts>
  import SearchBar from '$lib/ui-components/SearchBar.svelte'
  import { page } from '$app/stores'
  import { appBase } from '$lib/util/globals'

</script>

<h1>Visitor Queries</h1>
<SearchBar target={`${appBase}/queries`}/>
<div>
  <h2>No Matching Queries</h2>
  <p>Hmmm... We couldn't find any matches for "{$page.error?.message}".
     Double check your search spelling for errors or try different search terms.</p>
</div>

<style>

</style>
