<script lang="ts">
  import type { CityChip } from '@/entities/city';
  import { toneClasses } from '@/shared/lib/tone';

  interface Props {
    strengths: CityChip[];
    weaknesses: CityChip[];
  }

  let { strengths, weaknesses }: Props = $props();
</script>

{#snippet chipList(chips: CityChip[])}
  {#each chips as chip, index (chip.factorId)}
    <!-- Разделитель выражением: пробел в разметке между тегами Svelte схлопывает. -->
    {index > 0 ? ', ' : ''}<span class="font-medium {toneClasses(chip.tone).text}"
      >{chip.label}</span
    >
  {/each}
{/snippet}

<p class="text-base leading-snug" data-testid="summary-line">
  {#if strengths.length > 0}
    В топе за счёт: {@render chipList(strengths)}.
  {:else}
    Ровный профиль без явных плюсов.
  {/if}
  {#if weaknesses.length > 0}
    {weaknesses.length > 1 ? 'Минусы' : 'Минус'}: {@render chipList(weaknesses)}.
  {/if}
</p>
