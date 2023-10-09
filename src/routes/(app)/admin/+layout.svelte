<script lang="ts">
  import { afterNavigate, goto } from '$app/navigation'
  import { base } from '$app/paths'

  export let data: { isEditor?: boolean, login?: string }

  afterNavigate(() => {
    // make sure we're still logged in, and as the same user
    // if not, refresh the page so that our code in +layout.server.ts kicks in
    fetch(`${base}/self`).then(async resp => {
      const { login, isEditor } = await resp.json() as { login?: string, isEditor?: boolean }
      if (!login || !isEditor || login !== data.login) location.reload()
    }).catch(() => { location.reload() })
  })

  async function onLogout () {
    // this is a button with an on:click instead of a link with an href
    // because it's generally bad practice to change the user's state with
    // a link (e.g. browser accelerators sometimes pre-load link targets in
    // the background which would log the user out)
    await goto(base + '/logout')
  }
</script>

<header>
  <title>Search Featured Results Admin</title>
  <nav class='headerNav'>
    <!-- Can gen up a quick relatively broken home screen just so we have an entry page that will take
         us to a results that can also be temporarirly a mock-up while we get data populated. -->
    <a class='homelink' href='./search'>Featured Search</a>
    <a href='TODO'>Add Featured Search Result</a>
    <a href='TODO'>Visitor Searches</a>
    <button type="button" on:click={onLogout}>Logout</button>
  </nav>
</header>

<slot />

<footer>
  <nav class='footerNav'>
    <a href='TODO - Link to Online toolkit page, possibly with parameters to get to exact location.'>Manage Access</a>
    <a href='TODO'>Report an Issue</a>
  </nav>
</footer>
