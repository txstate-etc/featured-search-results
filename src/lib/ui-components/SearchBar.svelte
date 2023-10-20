<script lang=ts>
  /** Two-way bind for sharing the `search` value with sibling components. */
  export let search: string = ''
  /** The endpoint to direct search requests to. */
  export let target: string
</script>

<form name='SearchBar' action={`${target}?q=${search}`} method='GET'>
  <div class='searchbar'>
    <input type='search' name='q' placeholder='Search...' bind:value={search} />
    <input type='submit' value="Search"/>
  </div>
</form>

<style>
  .searchbar {
    margin-inline: auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding-top: 0.2rem;
  }
  input {
    border: 1px;
  }

</style>
