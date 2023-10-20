<script lang="ts">
  import { afterNavigate, goto } from '$app/navigation'
  import { apiBase, appBase } from '$lib/util/globals'

  export let data: { isEditor?: boolean, login?: string }

  afterNavigate(() => {
    // make sure we're still logged in, and as the same user
    // if not, refresh the page so that our code in +layout.server.ts kicks in
    fetch(`${apiBase}/self`).then(async resp => {
      const { login, isEditor } = await resp.json() as { login?: string, isEditor?: boolean }
      if (!login || !isEditor || login !== data.login) location.reload()
    }).catch(() => { location.reload() })
  })

  async function onLogout () {
    // this is a button with an on:click instead of a link with an href
    // because it's generally bad practice to change the user's state with
    // a link (e.g. browser accelerators sometimes pre-load link targets in
    // the background which would log the user out)
    await goto(apiBase + '/logout')
  }
</script>

<header>
  <title>Search Results Admin</title>
  <nav class='navbar'>
    <div class='container-fluid'>
      <div class='navbar-head'>
        <a class='app-brand' href={appBase}>Featured Search</a>
      </div>
      <ul class='navlist navbar-flex navbar-right'>
        <li><a href={appBase + '/result'}>Add Featured Search Result</a></li>
        <li><a href='TODO'>Visitor Searches</a></li>
        <li><button type="button" on:click={onLogout}>Logout</button></li>
      </ul>
    </div>
  </nav>
</header>

<main class='page-content media-context'>
  <div><slot /></div>
</main>

<footer>
  <nav class='navbar footer-nav'>
    <div class='container-fluid'>
      <ul class='navlist'>
        <li><a href='https://tim.txstate.edu/onlinetoolkit/Home/Role-Management'>Manage Access</a></li>
        <li><a href='TODO'>Report an Issue</a></li>
      </ul>
    </div>
  </nav>
</footer>

<style>
  /* Figure out how to set global colors, and how to reference them, by other components. */
  :global(html, body) {
    font-family: 'Roboto variant0';
    display: flex;
    flex-direction: column;
    margin: 0;
    height: 100%;
    min-height: 100%;
  }

  :global(input, select) {
    background-color: #F5F3F0;
    outline: 1px solid;
  }

  :global(button:hover) {
    opacity: 1;
  }

  header, footer {
    flex: none;
  }

  main {
    display: inline-table;
    overflow-y: scroll;
    flex: auto;
  }

  .footer-nav ul {
    list-style: none;
    text-align: center;
  }
  .footer-nav ul li {
    padding-right: 10px;
    padding-left: 10px;
    display: inline-block;
  }
  .footer-nav li:nth-child(n+2) {
    border-left:#e8e3db;
    border-left-width: 2px;
    border-left-style: groove;
  }

  .page-content {
    text-align: center;
    position: relative;
    margin: auto;
  }

  @media (max-width: 200) {
   .media-context {
      width: 90%
    }
  }
  @media (max-width: 900) {
   .media-context {
      width: 80%
    }
  }
  @media (min-width: 900) {
   .media-context {
      max-width: 700
    }
  }
  .container-fluid {
    padding-right: 15px;
    padding-left: 15px;
    margin-right: auto;
    margin-left: auto;
    display: flow-root;
  }

  .navbar {
    border-color: transparent;
    background-color: #501214;
    background-image: linear-gradient(to bottom,#501214 0,#501214 100%);
   }

   .navbar a {
    color:#e8e3db;
    text-decoration: none;
   }

   .navbar button {
      background: none;
      color: #e8e3db;
      border: none;
      padding: 0;
      font: inherit;
      cursor: pointer;
   }

  .navbar-head {
    margin: 7.5px;
    float: left;
  }

  .navlist {
    margin: 7.5px;
    list-style: none;
  }

  .navbar-flex {
    display: flex;
  }

  .navbar-right {
    float: right;
  }
  .navbar-right li {
    margin-left: 35px;
  }

  .navbar-right li:nth-last-child(1) {
    margin-left: 45px;
    margin-right: -10px;
  }

</style>
