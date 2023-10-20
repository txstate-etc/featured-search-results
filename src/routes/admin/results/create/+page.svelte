<script lang=ts>
  /** @type {import('./$types').PageData} */
  // export let data

  import ResultEditor from '$lib/ui-components/ResultEditor.svelte'
</script>

<h1>Add Featured Search Result</h1>
<div class='mediaContext'>
  <ResultEditor data={undefined} />
</div>
<style>
  .mediaContext {
    margin: auto;
    width: 60%
  }

</style>
