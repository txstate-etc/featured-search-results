<script lang=ts>
  import type { TemplateResult } from '$lib/models/result'
  import ResultEditor from '$lib/ui-components/ResultEditor.svelte'

  /** @type {import('./$types').PageData} */
  export let data: { result: TemplateResult }
</script>

<h1>Add Search Result</h1>
<ResultEditor data={data.result} />

<style>
</style>
