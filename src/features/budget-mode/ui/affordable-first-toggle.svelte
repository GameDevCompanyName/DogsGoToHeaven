<script lang="ts">
  import { Checkbox } from 'svelte-ascii-ui';

  import { getRankingContext } from '@/entities/ranking';

  const ranking = getRankingContext();
  const id = $props.id();

  function handleCheckedChange(isChecked: boolean) {
    ranking.setAffordableFirst(isChecked);
  }
</script>

<div class="flex items-center gap-2">
  <Checkbox
    {id}
    size="s"
    label="Сначала по карману"
    data-testid="affordable-first"
    bind:checked={() => ranking.isAffordableFirst, handleCheckedChange}
  />
</div>
