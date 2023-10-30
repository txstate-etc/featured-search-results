<script lang='ts' context='module'>
  import type { PropMeta } from './ResponsiveTable.svelte'
  import ArrayElementContent from './ArrayElementContent.svelte'
  /**
  Can supply ONE of two named slots (`'nestedArrayElementContent'` | `'plainArrayElementContent'`), OR use the default
  for customizing presentation of each element. All slots are mutually exclusive.
  #### Example Usage in Consumer - Note placement of `let:element`.
  ```ts
    <ArrayContent {record} {dataMeta} {format}>// Named
      <div slot='nestedArrayElementContent' let:element>
        <a href='https://google.com'>{format(dataMeta, element)}</a>
      </div>
      <div>{'Will not display. Mutually exclusive with named slots.'}</div>
    </ArrayContent>

    <ArrayContent {record} {dataMeta} {format} let:element>// Default
      <div><a href='https://google.com'>{format(dataMeta, element)}</a></div>
    </ArrayContent>
  ```
  */
  const documentation = null
</script>
<script lang='ts'>
  export let record: any
  export let dataMeta: PropMeta
  export let format: (meta: PropMeta, obj: any) => string
</script>

{#each record[dataMeta.key] as element}
  <ArrayElementContent bind:record bind:dataMeta bind:element bind:format>
    {#if $$slots.plainArrayElementContent || $$slots.nestedArrayElementContent}
      <slot slot='arrayElementContent' {record} {dataMeta} {element} {format} />
    {:else}
      <slot {record} {dataMeta} {element} {format} />
    {/if}
  </ArrayElementContent>
{/each}

<style>
</style>
