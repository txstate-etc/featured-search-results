<script lang=ts>
  import { onMount } from 'svelte'
  import { appBase, DEFAULT_PAGINATION_SIZE } from '$lib/util/globals'

  /**
  @Discussion - Some things to think about when we get around to extending the api to support
                pagination and wrapping result lists in it...

  When it comes to COLUMN SORTING do we want the column to sort on just the results currently
  listed on the page or across all results and refresh the page?

  I'm thinking the first option would be preferable as it allows for more granular inspection
  of listing subsets and keeps the api from having to be convoluted with sorting handling
  across all Query and Result records.
  */

  export let target: string = `${appBase}/results`
  /**
  Make pagesize's default value a global constant so form submissions between pages have a consistent
  default to pass and app request handers consistently know what sizes to default to so we don't give
  the <slot> here more results than we're communicating to the user as our limit. */
  export let pagesize: number = DEFAULT_PAGINATION_SIZE
  export let page: number = 0
  export let search: string
  export let sizeops: { value: number }[] = [{ value: 10 }, { value: 20 }, { value: 50 }, { value: 100 }, { value: 200 }]
  export let count: number | undefined

  onMount(() => {
    // Get a reference to the form object so you can call submit when pagesize <select on:change={}>
  })

  /** Need to bound the range of links generated so we only display a maximum width worth of links.
      Maybe subcomponent that out - or just keep in here to have all in one place. */
  $:pagecount = (count ?? pagesize / pagesize)

</script>

<form name='Pagination' action={`${target}?q=${search}&p=${page}&s=${pagesize}`} method='GET'>
  <select name='pagesize'>
    {#each sizeops as option}
    <option value={option.value} selected={option.value === pagesize} />
    {/each}
  </select>
  <slot />
</form>
{#if pagecount > 1 }
  {#each Array(Math.ceil(pagecount)) as _, index (index)}
    <a href={`${target}?q=${search}&p=${index}&s=${pagesize}`}>{index}</a>
  {/each}
{/if}

<style>

</style>
