<script lang=ts>
  import type { ResultBasicPlusId } from '$lib/models/result.js'
  import { appBase } from '$lib/util/globals'
  // TODO: Add `limit` for when this is nested in a <QueryList>.
  // TODO: Add pagination - maybe?

  /** Array of ResultBasicPlusId to generate a listing for. */
  export let data: ResultBasicPlusId[]
</script>

<div class='list-container'>
{#each data as result }
  <div class='result'>
    <h2>{result.title}</h2>
    <a href={result.url}>{result.url}</a>
    <a href={`${appBase}/results/${result.id}`}>{result.id}</a>
  </div>
{/each}
</div>

<style>
  .result {
    display: flex;
    margin-inline: auto;
    width: 80%;
  }
</style>
