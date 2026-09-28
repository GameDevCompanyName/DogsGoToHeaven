<script lang="ts">
  import type { Factor } from '@/shared/lib/ranking';

  import CategoricalFactorControl from './categorical-factor-control.svelte';
  import NumericFactorControl from './numeric-factor-control.svelte';

  interface Props {
    factor: Factor;
  }

  let { factor }: Props = $props();
</script>

{#if factor.kind === 'numeric'}
  <NumericFactorControl {factor} />
{:else}
  <CategoricalFactorControl {factor} />
{/if}
