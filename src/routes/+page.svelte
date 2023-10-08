<script lang="ts">
  export let data: { isEditor?: boolean, login?: string }
</script>
<h1>Welcome to SvelteKit</h1>
<p>Visit <a href="https://kit.svelte.dev">kit.svelte.dev</a> to read the documentation</p>
{data.login} {data.isEditor}
