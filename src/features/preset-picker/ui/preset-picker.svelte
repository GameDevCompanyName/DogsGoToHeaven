<script lang="ts">
  import { getRankingContext } from '@/entities/ranking';
  import type { Preset } from '@/shared/lib/ranking';
  import { Label } from '@/shared/ui/label';
  import * as Select from '@/shared/ui/select';

  const ranking = getRankingContext();

  const durationPresets = ranking.presets.filter((preset) => preset.kind === 'duration');
  const incomePresets = ranking.presets.filter((preset) => preset.kind === 'income');

  function handleDurationChange(presetId: string) {
    ranking.applyPresets(presetId || null, ranking.incomePresetId);
  }

  function handleIncomeChange(presetId: string) {
    ranking.applyPresets(ranking.durationPresetId, presetId || null);
  }
</script>

{#snippet presetSelect(
  id: string,
  label: string,
  presets: Preset[],
  value: string | null,
  onchange: (presetId: string) => void,
)}
  <div class="flex min-w-0 flex-col gap-1.5">
    <Label for={id}>{label}</Label>
    <Select.Root type="single" bind:value={() => value ?? '', onchange}>
      <Select.Trigger {id} class="w-full">
        {presets.find((preset) => preset.id === value)?.name ?? 'Не выбрано'}
      </Select.Trigger>
      <Select.Content>
        {#each presets as preset (preset.id)}
          <Select.Item value={preset.id} label={preset.name} />
        {/each}
      </Select.Content>
    </Select.Root>
  </div>
{/snippet}

<div class="grid grid-cols-2 gap-3">
  {@render presetSelect(
    'preset-duration',
    'Срок',
    durationPresets,
    ranking.durationPresetId,
    handleDurationChange,
  )}
  {@render presetSelect(
    'preset-income',
    'Доход',
    incomePresets,
    ranking.incomePresetId,
    handleIncomeChange,
  )}
</div>
