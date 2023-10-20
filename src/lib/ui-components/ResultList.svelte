<script lang=ts>
  import type { ResultBasicPlusId } from '$lib/models/result.js'
  import { appBase } from '$lib/util/globals'

  // export items: ResultFull[]
  export let data: ResultBasicPlusId[]
  // TODO: Add pagination for regular listings and `limit` for when this is nested in a <QueryList>.
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
