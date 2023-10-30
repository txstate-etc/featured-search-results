<script lang=ts>
  import { onMount } from 'svelte'
  import { appBase, DEFAULT_PAGESIZE_OPTIONS, DEFAULT_PAGINATION_SIZE } from '$lib/util/globals'

  /**
  @Discussion - Some things to think about when we get around to extending the api to support
                pagination and wrapping result lists in it...

  When it comes to COLUMN SORTING do we want the column to sort on just the results currently
  listed on the page or across all results and refresh the page?

  I'm thinking the first option would be preferable as it allows for more granular inspection
  of listing subsets and keeps the api from having to be convoluted with sorting handling
  across all Query and Result records.
  */

  /** The endpoint to direct pagination update requests to. */
  export let target: string = `${appBase}/results`
  /** The maximum number of results to display per page - and offset multiplier for subsequent pages. */
  export let pagesize: number = DEFAULT_PAGINATION_SIZE
  /** The page offset (0 = 1st page) */
  export let page: number = 0
  /** The search query associated with the results being paginated. */
  export let search: string
  /** The list of pagesize options to offer. */
  export let sizeops: { value: number }[] = DEFAULT_PAGESIZE_OPTIONS
  /** The total number of results associated with the search query. */
  export let count: number | undefined

  onMount(() => {
    // Get a reference to the form object so you can call submit when pagesize <select on:change={}>
  })

  /** Need to bound the range of links generated so we only display a maximum width worth of links.
      Maybe subcomponent that out - or just keep in here to have all in one place. */
  $:pageCount = (count ?? pagesize) / pagesize
  $:pageStart = (page * pagesize) + 1
  $:pageEnd = (page + 1) * pagesize
  $:displayCount = count ?? 0
  $:displayStart = (pageStart < displayCount) ? pageStart : displayCount
  $:displayEnd = (pageEnd < displayCount) ? pageEnd : displayCount

</script>

<!-- Test this, the browser should add these to form (rename to appropriate acronyms) but SvelteKit might get in the way. If it doesn't remove all the appending here. -->
<form name='Pagination' action={`${target}?q=${search}&p=${page}&n=${pagesize}`} method='GET'>
  <select name='pagesize'>
    {#each sizeops as option}
      <option value={option.value} selected={option.value === pagesize} />
    {/each}
  </select>
  <slot />
</form>
{#if displayCount > 0}
  <p>Showing {displayStart} to {displayEnd} of {displayCount} entries.</p>
{/if}
{#if pageCount > 1 }
  {#each Array(Math.ceil(pageCount)) as _, index (index)}
    <a href={`${target}?q=${search}&p=${index}&s=${pagesize}`}>{index}</a>
  {/each}
{/if}

<style>

</style>
