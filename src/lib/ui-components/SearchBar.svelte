<script lang='ts'>
  import { invalidate } from '$app/navigation'

  /** Two-way bind for sharing the `search` value with sibling components. */
  export let search: string = ''
  /** The endpoint to direct search requests to. */
  export let target: string
  /** Handle that pageLoad assigned to itself for the last search ran.
   * Used to invalidate the cache for the last search ran so we can re-run it and find
   * any new results that may have been added since the last search. */
  export let reloadHandle: string = ''

  /** STUB: Looking into getting unchanged searches to go ahead and reload the page data despite the url not being changed.
   *  Need to look into overloading the submit button. */
  async function rerunLoad () {
    await invalidate(reloadHandle)
  }
</script>

<form name='SearchBar' action={target} method='GET' data-sveltekit-keepfocus>
  <div class='searchbar'>
    <input type='search' name='q' placeholder='Search...' bind:value={search} />
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
