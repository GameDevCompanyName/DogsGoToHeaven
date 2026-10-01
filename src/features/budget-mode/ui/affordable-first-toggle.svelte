<script lang="ts">
  import { getRankingContext } from '@/entities/ranking';
  import { Checkbox } from '@/shared/ui/checkbox';
  import { Label } from '@/shared/ui/label';

  const ranking = getRankingContext();
  const id = $props.id();

  function handleCheckedChange(isChecked: boolean) {
    ranking.setAffordableFirst(isChecked);
  }
</script>

<div class="flex items-center gap-2">
  <Checkbox
    {id}
    data-testid="affordable-first"
    bind:checked={() => ranking.isAffordableFirst, handleCheckedChange}
  />
  <Label for={id} class="text-base font-normal">Сначала по карману</Label>
</div>
