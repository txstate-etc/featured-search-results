<script lang="ts" context="module">
  export const DG_DIALOG_FIELD_MULTIPLE = {}
  function noOp (..._: any[]) { return '' }
</script>
<script lang="ts">
  import caretCircleDown from '@iconify-icons/ph/caret-circle-down'
  import caretCircleUp from '@iconify-icons/ph/caret-circle-up'
  import plusCircleLight from '@iconify-icons/ph/plus-circle-light'
  import xCircle from '@iconify-icons/ph/x-circle'
  import { AddMore, FORM_CONTEXT, FORM_INHERITED_PATH } from '@txstate-mws/svelte-forms'
  import type { FormStore } from '@txstate-mws/svelte-forms'
  import { derivedStore } from '@txstate-mws/svelte-store'
  import { getContext, setContext } from 'svelte'
  import { isNotNull } from 'txstate-utils'
  import { Button, Container, Icon } from '@dosgato/dialog'

  export let path: string
  export let label: string
  export let initialState: any | ((index: number) => any) = undefined
  export let minLength = 1
  export let maxLength: number | undefined = undefined
  export let compact = false
  export let removable = false
  export let reorder = false
  export let conditional: boolean | undefined = undefined
  export let addMoreText = 'Add'
  export let maxedText = addMoreText
  export let addMoreClass: string | undefined = undefined
  export let related: true | number = 0
  export let helptext: string | undefined = undefined

  const fieldMultipleContext: { helptextid: string | undefined } = { helptextid: undefined }
  setContext(DG_DIALOG_FIELD_MULTIPLE, fieldMultipleContext)
  const inheritedPath = getContext<string>(FORM_INHERITED_PATH)
  const finalPath = [inheritedPath, path].filter(isNotNull).join('.')
  const store = getContext<FormStore>(FORM_CONTEXT)
  const messageStore = derivedStore(store, ({ messages }) => messages.all.filter(m => m.path?.startsWith(finalPath)))

  const reorderupelements: HTMLButtonElement[] = []
  const reorderdownelements: HTMLButtonElement[] = []
  function moveUpAndFocus (onMove: () => void, idx: number) {
    return () => {
      onMove()
      let newFocus = reorderupelements[idx - 1]
      if (newFocus) {
        if (newFocus.disabled) newFocus = reorderdownelements[idx - 1]
        newFocus.focus()
      }
    }
  }
  function moveDownAndFocus (onMove: () => void, idx: number) {
    return () => {
      onMove()
      let newFocus = reorderdownelements[idx + 1]
      if (newFocus) {
        if (newFocus.disabled) newFocus = reorderupelements[idx + 1]
        newFocus.focus()
      }
    }
  }

  $: messages = compact ? $messageStore : []
</script>

<Container {label} {messages} {conditional} {related} {helptext} let:helptextid>
  {noOp(fieldMultipleContext.helptextid = helptextid)}
  <AddMore {path} {initialState} {minLength} {maxLength} {conditional} let:path let:currentLength let:maxLength let:index let:minned let:maxed let:value let:onDelete let:onMoveUp let:onMoveDown>
    {@const showDelete = removable && !minned}
    {@const showMove = reorder && currentLength > 1}
    <div class="dialog-multiple" class:has-delete-icon={showDelete} class:has-move-icon={showMove} class:first={index === 0}>
      <div class="dialog-multiple-content">
        <slot {path} {index} {value} {maxed} {maxLength} {currentLength}/>
      </div>
      {#if showDelete || showMove}
        <div class="dialog-multiple-buttons">
        {#if showMove}
          <button bind:this={reorderdownelements[index]} class="dialog-multiple-move" type="button" disabled={index === currentLength - 1} on:click|preventDefault|stopPropagation={moveDownAndFocus(onMoveDown, index)}>
            <slot name='mvDownBtnIcon'>
              <Icon icon={caretCircleDown} hiddenLabel="move down in the list" />
            </slot>
          </button>
          <button bind:this={reorderupelements[index]} class="dialog-multiple-move" type="button" disabled={index === 0} on:click|preventDefault|stopPropagation={moveUpAndFocus(onMoveUp, index)}>
            <slot name='mvUpBtnIcon'>
              <Icon icon={caretCircleUp} hiddenLabel="move up in the list" />
            </slot>
          </button>
        {/if}
        {#if showDelete}
          <button class="dialog-multiple-delete" type="button" on:click|preventDefault|stopPropagation={onDelete}>
            <slot name='removeBtnIcon'>
              <Icon icon={xCircle} hiddenLabel="remove from list" />
            </slot>
          </button>
        {/if}
        </div>
      {/if}
    </div>
    <svelte:fragment slot="addbutton" let:maxed let:onClick>
      <Button type="button" icon={plusCircleLight} class="{addMoreClass} dialog-multiple-button" disabled={maxed} on:click={onClick}>{maxed ? maxedText : addMoreText}</Button>
    </svelte:fragment>
  </AddMore>
</Container>

<style>
  .dialog-multiple {
    position: relative;
    border: var(--dialog-container-border, 1px dashed #CCCCCC);
    padding: var(--dialog-container-padding, 1.5em);
  }
  .dialog-multiple:not(.first) {
    border-top: 0;
  }
  .dialog-multiple:nth-of-type(even) {
    background-color: var(--dialog-field-bg1, transparent);
    color: var(--dialog-field-text1, inherit);
  }
  .dialog-multiple:nth-of-type(odd) {
    background-color: var(--dialog-field-bg2, transparent);
    color: var(--dialog-field-text2, inherit);
  }
  .dialog-multiple-buttons {
    position: absolute;
    top: 0;
    right: 0.1em;
    display: flex;
  }
  .dialog-multiple-buttons button {
    border: 0;
    background: transparent;
    padding: 0.15em;
    cursor: pointer;
    font-size: 1.3em;
    color: black;
  }
  .dialog-multiple-buttons button:disabled {
    color: #6d6d6d;
  }
</style>
