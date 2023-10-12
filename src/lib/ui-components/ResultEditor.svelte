<script lang=ts>
  import { Form, Field, AddMore } from '@txstate-mws/svelte-forms'

  // Maybe spiff up the page adding enhance to the forms and adding these transitions.
  // Might need to add to the form library or custom rebuild it here with them.
  // import { enhance } from '$app/forms'
  // Example: <form .... use:enhance ... >
  // import { fly, slide } from 'svelte/transition'
  // Example: <li in:fly={{ y: 20 }} out:slide>

  async function onRemove () {
    // Remove entry's elements from AddMore element in DOM possibly needing to call
    // its API or interact via its two-way binds. Ensure it's reliably handling destroy.
  }
</script>

<Form name="result">
  <Field path="title"> ... </Field>
  <Field path="url"> ... </Field>
  <AddMore path="entries">
    <Field path="keyphrase"><input/><!-- Basic Input --> </Field>
    <Field path="type"> <!-- Selector List --> </Field>
    <Field path="priority"> <!-- Numeric Integer Input --> </Field>
    <button class="removeButton" aria-label="Remove Entry" on:click={onRemove}></button>
  </AddMore>
  <Field path="tags"> ... </Field>
</Form>

<style>
  .removeButton {
    border: none;
    background: url($static/remove.svg) no-repeat 50% 50%;
    background-size: 1rem 1rem;
    cursor: pointer;
    height: 100%;
    aspect-ratio: 1;
    opacity: 0.5;
    transition: opacity 0.2s;
  }

  button:hover {
    opacity: 1;
  }
</style>
