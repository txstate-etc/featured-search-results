<script lang='ts' context='module'>
  import type { Feedback } from '@txstate-mws/svelte-forms'
</script>
<script lang='ts'>
  /** The the Feedback messages to inspect for building links. */
  export let data: Feedback[]
  /** The regular expression to match against the `path` property of each `Feedback` object.
   * If named groupings are included in the RE, they will be accessible as subproperties of
   * the `found` Record passed to callbacks used to build the links along with being included
   * in `keys` array of what groups were found that are also passed to the callbacks. */
  export let path: RegExp
  /** The URL to prefix to the generated links. */
  export let targetURL: string
  /** Any named RE groupings you want to have passed to the callbacks. */
  export let pathKeys: string[]
  /** A callback that takes the `found` Record and the `keys` array and returns the sveltekit
   * slugs to append to the `targetURL` to build the link. */
  export let buildPath: (found: Record<string, string>, keys: string[]) => string
  /** A callback that takes the `found` Record and the `keys` array and returns the text to
   * display in the link. */
  export let getText: (found: Record<string, string>, keys: string[]) => string
  /** Any preamble text you would like displayed before the link. */
  export let preamble: string
  /** Any postscript text you would like displayed after the link. */
  export let postscript: string

  $: filtered = data.filter(m => path.test(m.path ?? ''))
  $: targetParams = filtered.reduce<Record<string, string>[]>((params, cur) => {
    const namedMatches = cur.path!.match(path)!.groups
    if (!namedMatches) return params
    let record = {}
    pathKeys.forEach(group => {
      record = { ...record, [group]: namedMatches[group] }
    })
    params.push(record)
    return params
  }, [])
</script>
<!--
  @component
  TODO: Add reference description for component that's displayed in VSCode editors.
-->

{#if targetParams.length > 0}
  <div class='feedback-links'>
    {#each targetParams as target}
      {preamble}<a href='{`${targetURL}${buildPath(target, pathKeys)}`}'>{getText(target, pathKeys)}</a>{postscript}
    {/each}
  </div>
{/if}

<style>
  .feedback-links {
    margin-top: var(--element-container-spacing);
  }
  .feedback-links a {
    margin-bottom: var(--element-container-spacing);
  }
</style>
