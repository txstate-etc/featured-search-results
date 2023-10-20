<script lang=ts>
  import ResultList from './ResultList.svelte'
  import type { QueryBasic } from '$lib/models/query'

  /** Array of `QueryBasic` records to generate a list for. */
  export let data: QueryBasic[]
</script>

<div class='list-container'>
{#each data as query}
  <div class='query'>
    <ul>
      <li>{query.query}</li>
      <li>{query.hits}</li>
      <li>{query.lasthit.toLocaleTimeString()}</li>
    </ul>
    <!-- Make this a collapsable list they can expand - similar to (show more) in help text or folders in PageTree -->
    <div class='result-list'>
      <ResultList data={query.results} />
    </div>
  </div>
{/each}
</div>

<style>
  .query {
    display: flex;
    margin-inline: auto;
    width: 80%;
  }
</style>
