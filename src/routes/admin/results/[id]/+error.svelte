<script lang=ts>
  import SearchBar from '$lib/ui-components/SearchBar.svelte'
  import { page } from '$app/stores'

</script>

<h1>Edit Featured Search Result</h1>
<div>
  <h2>{$page.error?.message ?? 'Bad Identifier'}</h2>
  <p>Hmmm... No results were found matching that identifier.</p>
</div>

<style>

</style>
