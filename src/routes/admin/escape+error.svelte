<script lang=ts>
  import { page } from '$app/stores'
</script>

<h1>Search Results Admin</h1>
<h2>{@html $page.error?.message ?? 'Bad Identifier'}</h2>
{#if $page.error?.message === undefined}
  <p>Hmmm... No data was found corresponding to that request at:
    <code>{JSON.stringify($page.url)}</code>
  </p>
{/if}
{#if $page.error?.message.startsWith('You are not authorized')}
  <p>Please request access to the editors group and logout out and back in to continue once added.</p>
{/if}

<style>
</style>
