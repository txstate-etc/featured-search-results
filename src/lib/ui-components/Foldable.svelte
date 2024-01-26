<script lang=ts>
  export let folded = false
  export let foldedHeight = '4.4rem;'
  let showControls = false
  let contentElement: HTMLElement
  function seeMoreHandler () { folded = !folded }
  $:showControls = contentElement.scrollHeight > parseInt(foldedHeight)
</script>

<div class="foldable" style={`--foldedHeight: ${foldedHeight}`}>
  <div bind:this={contentElement} class='foldable-contents' class:folded aria-expanded={!folded}>
    <slot></slot>
  </div>
  {#if showControls}
    <div class='foldable-controls'>
      <button on:click={seeMoreHandler}>
        {folded ? '( See More... )' : '( Collapse )' }
      </button>
    </div>
  {/if}
</div>

<style>
.foldable {
  display: flex;
  flex-direction: row;
  align-content: inline-flex;
  width: auto;
  justify-content: space-between
}
.foldable-contents {
  display: flex;
  flex-direction: column;
  justify-content: left;
  height: auto;
}
.folded {
  height: var(--foldedHeight);
  overflow: hidden;
  mask-image: linear-gradient(180deg, #000 20%, transparent);
}
button {
  background-color:transparent;
  color:blue;
  position: relative;
  top: 0;
  border: none;
  width: auto;
  margin: 0;
  cursor: pointer;
}
</style>
