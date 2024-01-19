<script lang='ts'>
  import { goto, invalidate } from '$app/navigation'
  import { DEFAULT_PAGINATION_SIZE } from '$lib/util/globals'
  import type { SortParam } from '$lib/util/helpers'

  /** Two-way bind for sharing the `search` value with sibling components. */
  export let search: string = ''
  /** The endpoint to direct search requests to. */
  export let target: string
  /** The maximum number of results to display per page - and offset multiplier for subsequent pages. */
  export let pagesize: number = DEFAULT_PAGINATION_SIZE
  /** The page offset (0 = 1st page) */
  export let page: number = 0
  export let sorts: SortParam[] = []
  /** Handle that pageLoad assigned to itself for the last search ran.
   * Used to invalidate the cache for the last search ran so we can re-run it and find
   * any new results that may have been added since the last search. */
  export let reloadHandle: string = ''

  /** Force page to go ahead and reload the page data despite the url not being changed. */
  async function rerunLoad () {
    await invalidate(reloadHandle)
    await goto(`${target}?q=${search}&p=${page}&n=${pagesize}&s=${JSON.stringify(sorts)}`)
  }
</script>

<form name='SearchBar' action={`${target}?q=${search}&p=${page}&n=${pagesize}&s=${JSON.stringify(sorts)}`} method='GET' data-sveltekit-keepfocus>
  <div class='searchbar'>
    <input type='search' placeholder='Search...' bind:value={search} />
    <button on:click={rerunLoad} type='submit' class='submit-button'>Search</button>
  </div>
</form>

<style>
  .searchbar {
    margin-inline: auto;
    display: flex;
    flex-direction: row;
    align-items: center;
    margin-top: var(--element-container-spacing);
  }
  input {
    flex-grow: 1;
    line-height: 1;
    padding: 0.3rem;
    margin-right: var(--margin-below-labels);
    border: var(--dialog-container-border);
  }
  button {
    padding: var(--search-button-padding);
  }

</style>
