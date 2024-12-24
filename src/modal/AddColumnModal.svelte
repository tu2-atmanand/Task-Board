<script lang="ts">
  import { createEventDispatcher } from "svelte";

  interface Props {
    isOpen: boolean;
    t: (key: number) => string; // Localization function
  }

  let { isOpen, t }: Props = $props();
  const dispatch = createEventDispatcher();

  let colType = $state("undated");
  let name = $state("");

  // Emit the submit event with column data
  function handleSubmit() {
    const active = true;
    dispatch("submit", { colType, name, active });
    handleClose();
  }

  // Emit the close event
  function handleClose() {
    dispatch("close");
  }
</script>

{#if isOpen}
  <div class="addColumnModalOverlay">
    <div class="addColumnModalOverlayContent">
      <h2>{t(56)}</h2>

      <div class="addColumnModalOverlayContentField">
        <label for="colType">{t(10)}</label>
        <select id="colType" bind:value={colType}>
          <option value="undated">{t(11)}</option>
          <option value="dated">{t(12)}</option>
          <option value="namedTag">{t(13)}</option>
          <option value="untagged">{t(14)}</option>
          <option value="completed">{t(15)}</option>
          <option value="otherTags">{t(16)}</option>
        </select>
      </div>

      <div class="addColumnModalOverlayContentField">
        <label for="name">{t(17)}</label>
        <input
          type="text"
          id="name"
          bind:value={name}
          placeholder={t(20)}
        />
      </div>

      <div class="addColumnModalOverlayContentActions">
        <button onclick={handleSubmit}>{t(18)}</button>
        <button onclick={handleClose}>{t(19)}</button>
      </div>
    </div>
  </div>
{/if}
