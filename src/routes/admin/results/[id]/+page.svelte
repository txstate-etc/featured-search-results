<script lang=ts>
  import ResultEditor from '$lib/ui-components/ResultEditor.svelte'
  import type { TemplateResult } from '$lib/models/result.js'

  /** @type {import('./$types').PageData} */
  export let data: TemplateResult
</script>

<h1>Edit Featured Search Result</h1>
<ResultEditor {data} />

<style>

</style>
