<script lang=ts>
  import { Form, Field, AddMore } from '@txstate-mws/svelte-forms'
</script>

<Form name="result">
  <Field path="title"> ... </Field>
  <Field path="url"> ... </Field>
  <AddMore path="entries">
    <Field path="keyphrase"><input/><!-- Basic Input --> </Field>
    <Field path="type"> <!-- Selector List --> </Field>
    <Field path="priority"> <!-- Numeric Integer Input --> </Field>
    <button>X<!-- Replace with trash icon --></button>
  </AddMore>
  <Field path="tags"> ... </Field>
</Form>

<style>

</style>
