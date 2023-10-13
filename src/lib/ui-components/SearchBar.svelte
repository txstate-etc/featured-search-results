<script lang=ts>
  import { Field, Form } from '@txstate-mws/svelte-forms'
</script>

<Form >
  <div class='searchbar'>
    <Field path="q">
      <input autocorrect=false width='50'>
    </Field>
    <button>Search</button>
  </div>
  <a href="/admin/results">Browse All Results</a>
</Form>

<style>
  .searchbar {
    display: flex-flow;
  }

  input {
    width: 300px;
    min-width: 100px;
  }
  a {
    font-size:small;
    color: #000;
  }
</style>
