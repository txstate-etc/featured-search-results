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
        <li><a href={appBase + '/results/create'}>Add Search Result</a></li>
        <li><a href='TODO'>Visitor Searches</a></li>
        <li><button type="button" on:click={onLogout}>Logout</button></li>
      </ul>
    </div>
  </nav>
</header>

<main>
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

    --colors-white: #fff;
    --colors-paper: #f5f3f0;
    --colors-vellum: #E8E3DB;
    --colors-maroon: #501214;
    --colors-gold: #9F661C;
    --colors-blue: #005481;
    --colors-grey: #808080;
    --colors-red: #FF1717;

    --colors-navbar-background: var(--colors-maroon);
    --colors-input-background: var(--colors-paper);
    --colors-navbar-text: var(--colors-vellum);
    --colors-help: var(--colors-blue);
    --colors-focus: var(--colors-maroon);

    --dialog-container-border: 1px solid #999999;
    --dg-button-bg: var(--colors-maroon);
    --dg-button-text: var(--colors-vellum);
  }
  :global(input, select) {
    background-color: var(--colors-input-background);
    outline: 1px solid;
  }
  :global(:focus) {
    outline: 3px solid var(--colors-focus);
  }
  :global(button:hover) {
    opacity: 1;
  }
  main {
    flex-grow: 1;
    margin: auto;
    width: 60%;
  }
  main :global(h1) {
    text-align: center;
  }
  header, footer {
    flex: none;
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
  .footer-nav li:not(:first-child) {
    border-left: var(--colors-navbar-text);
    border-left-width: 2px;
    border-left-style: groove;
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
    background-color: var(--colors-navbar-background);
    background-image: linear-gradient(to bottom, var(--colors-navbar-background) 0, var(--colors-navbar-background) 100%);
   }
   .navbar a {
    color: var(--colors-navbar-text);
    text-decoration: none;
   }
   .navbar button {
      background: none;
      color: var(--colors-navbar-text);
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
