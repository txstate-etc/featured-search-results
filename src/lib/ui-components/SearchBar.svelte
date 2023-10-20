<script lang=ts>
  import { appBase } from '$lib/util/globals'

  export let search: string = ''
  export let target: string

</script>

<form name='SearchBar' action={target} method='GET'>
  <div class='searchbar'>
    <input type='search' name='q' placeholder='Search...' id='searchInput' bind:value={search} />
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
