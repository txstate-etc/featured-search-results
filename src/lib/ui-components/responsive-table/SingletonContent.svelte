<script lang='ts' context='module'>
  import type { PropMeta } from './ResponsiveTable.svelte'
  /**
  Can forward the named slot OR use the default for customizing presentation of each element.
  #### Example Usage in Consumer
  ```ts
    <SingletonContent {record} {dataMeta} {format}>// Named
      <div slot='nestedSingletonContent'>
        <a href='https://google.com'>{format(dataMeta, record[dataMeta.key])}</a>
      </div>
      <div>{'Will not display. Mutually exclusive with named slots.'}</div>
    </SingletonContent>

    <SingletonContent {record} {dataMeta} {format}>// Default
      <div><a href='https://google.com'>{format(dataMeta, record[dataMeta.key])}</a></div>
    </SingletonContent>
  ```
  */
  const documentation = null

</script>
<script lang='ts'>
  export let record: any
  export let dataMeta: PropMeta
  export let format: (meta: PropMeta, obj: any) => string
</script>

<div class:complex-container={dataMeta.shouldNest}>
  {#if $$slots.singletonContent}
    <slot {record} {dataMeta} {format}>
      {@html format(dataMeta, record[dataMeta.key])}
    </slot>
  {:else}
    <slot {record} {dataMeta} {format}>
      {@html format(dataMeta, record[dataMeta.key])}
    </slot>
  {/if}
</div>

<style>
</style>
