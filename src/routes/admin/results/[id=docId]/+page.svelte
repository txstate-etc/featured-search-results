<script lang=ts>
  import ResultEditor from '$lib/ui-components/ResultEditor.svelte'
  import type { TemplateResult } from '$lib/models/result.js'
  import { apiURL } from '$lib/util/globals'

  /** @type {import('./$types').PageData} */
  export let data: { result: TemplateResult }
  const apiTarget = { url: `${apiURL}/result/${data.result.id}`, method: 'PUT' }
</script>

<h1>Edit Featured Search Result</h1>
<ResultEditor data={data.result} {apiTarget}/>

<style>

</style>
