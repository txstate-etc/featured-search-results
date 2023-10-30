<script lang='ts' context='module'>
  import type { PropMeta } from '../ResponsiveTable.svelte'
</script>
<script lang='ts'>
  export let record: any
  export let dataMeta: PropMeta
  export let element: any
  export let format: (meta: PropMeta, obj: any) => string
</script>

<div>
  {#if $$slots.arrayElementContent}
    <slot {record} {dataMeta} {element} {format}>
      {@html format(dataMeta, element)}
    </slot>
  {:else}
    <slot {record} {dataMeta} {element} {format}>
      {@html format(dataMeta, element)}
    </slot>
  {/if}
</div>

<style>

</style>
