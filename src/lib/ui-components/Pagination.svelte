<script lang='ts' context='module'>
  import { goto } from '$app/navigation'
  import { DEFAULT_PAGESIZE_OPTIONS, DEFAULT_PAGINATION_SIZE } from '$lib/util/globals'
  import type { SortParam } from '$lib/util/helpers'
</script>
<script lang=ts>
  /** TODO:
   - Add form submit to pagesize <select>
    <select onchange="this.form.submit()">

  @Discussion - Some things to think about when we get around to extending the api to support
                pagination and wrapping result lists in it...

  When it comes to COLUMN SORTING do we want the column to sort on just the results currently
  listed on the page or across all results and refresh the page?

  I'm thinking the first option would be preferable as it allows for more granular inspection
  of listing subsets and keeps the api from having to be convoluted with sorting handling
  across all Query and Result records.
  */

  /** The search query associated with the results being paginated. */
  export let search: string
  /** The endpoint to direct pagination update requests to. */
  export let target: string
  /** The maximum number of results to display per page - and offset multiplier for subsequent pages. */
  export let pagesize: number = DEFAULT_PAGINATION_SIZE
  /** The page offset (0 = 1st page) */
  export let page: number = 0
  export let sorts: SortParam[] = []
  /** The list of pagesize options to offer. */
  export let sizeops: { value: number }[] = DEFAULT_PAGESIZE_OPTIONS
  /** The total number of results associated with the search query. */
  export let total: number | undefined

  /** Need to bound the range of links generated so we only display a maximum width worth of links.
      Maybe subcomponent that out - or just keep in here to have all in one place. */
  $:pageOffset = page - 1
  $:pageCount = Math.ceil((total ?? pagesize) / pagesize)
  $:pageStart = ((pageOffset) * pagesize) + 1
  $:pageEnd = (pageOffset + 1) * pagesize
  $:displayTotal = total?.toLocaleString() ?? 0
  $:displayStart = (pageStart < (total ?? 0)) ? pageStart.toLocaleString() : displayTotal.toLocaleString()
  $:displayEnd = (pageEnd < (total ?? 0)) ? pageEnd.toLocaleString() : displayTotal.toLocaleString()
  $:previousPage = (pageOffset > 0) ? page - 1 : undefined
  $:nextPage = (page < pageCount) ? page + 1 : undefined
  $:linksFrameStart = (pageOffset - 2 > 1) ? pageOffset - 2 : 1
  $:linksFrameEnd = (pageOffset + 3 < pageCount) ? page + 3 : pageCount + 1
  $:linksFrame = Array(linksFrameEnd - linksFrameStart).fill(0).map((_, i) => i + linksFrameStart)
  $:console.log('linksFrame', linksFrame)

  async function handlePageSizeChange (e: Event) {
    const etarget = e.target as HTMLSelectElement
    pagesize = parseInt(etarget.value)
    await goto(`${target}?q=${search}&p=1&n=${pagesize}&s=${JSON.stringify(sorts)}`)
  }

  // TODO: Add a sticky 'back to top' button that appears when the user scrolls the top of the page out of view.
</script>

<!-- Test this, the browser should add these to form (rename to appropriate acronyms) but SvelteKit might get in the way. If it doesn't remove all the appending here. -->
<form name='Pagination' id='paginator'
      action={`${target}?q=${search}&p=${page}&n=${pagesize}&s=${JSON.stringify(sorts)}`} method='GET'
      on:change={handlePageSizeChange}>
  <div class='pagesize-selector-container'>
    <label for='pagesize'>Results per page:</label>
    <select class='pagesize-selector' name='pagesize'>
      {#each sizeops as option}
        <option value={option.value} selected={option.value === pagesize}>{option.value}</option>
      {/each}
    </select>
  </div>
  <slot />
  <div class='pagination-footer-container'>
    {#if (total ?? 0) > 0}
      <p>Showing {displayStart} to {displayEnd} of {displayTotal} entries.</p>
    {/if}
    {#if pageCount > 1 }
      <div class='page-links-container'>
        <label for='page-links'>Page:</label>
        <div class='page-links' id='page-links'>
          {#if linksFrameStart > 1}
            <a href={`${target}?q=${search}&p=1&n=${pagesize}&s=${JSON.stringify(sorts)}`}>&lt;&lt;</a>
          {/if}
          {#if previousPage !== undefined}
            <a href={`${target}?q=${search}&p=${previousPage}&n=${pagesize}&s=${JSON.stringify(sorts)}`}>&lt;</a>
          {/if}
          {#each linksFrame as pageRef}
            <a class:current-page-link={pageRef === page} href={`${target}?q=${search}&p=${pageRef}&n=${pagesize}&s=${JSON.stringify(sorts)}`}>{pageRef}</a>
          {/each}
          {#if nextPage !== undefined}
            <a href={`${target}?q=${search}&p=${nextPage}&n=${pagesize}&s=${JSON.stringify(sorts)}`}>&gt;</a>
          {/if}
          {#if linksFrameEnd < pageCount}
            <a href={`${target}?q=${search}&p=${pageCount}&n=${pagesize}&s=${JSON.stringify(sorts)}`}>&gt;&gt;</a>
          {/if}
        </div>
      </div>
    {/if}
    <div class='pagesize-selector-container'>
      <label for='pagesize'>Results per page:</label>
      <select class='pagesize-selector' name='pagesize'>
        {#each sizeops as option}
          <option value={option.value} selected={option.value === pagesize}>{option.value}</option>
        {/each}
      </select>
    </div>
  </div>
</form>

<style>
  .pagesize-selector-container {
    display: flex;
    justify-content: right;
    flex-direction: row;
    margin-bottom: var(--margin-below-labels);
  }
  .pagesize-selector {
    margin-bottom: var(--margin-below-labels);
    width:auto;
    margin-left: 0.3rem;
  }
  .pagination-footer-container {
    display: flex;
    flex-direction: row;
    justify-content:space-between;
    align-items: center;
    margin-top: var(--element-container-spacing);
    margin-bottom: var(--element-container-spacing);
  }
  .page-links-container {
    display: flex;
    align-items: center;
  }
  .page-links-container * {
    margin: 0.25rem;
    cursor: pointer;
    align-items: center;
  }
  .current-page-link {
    font-size: 1.25em;
  }
</style>
