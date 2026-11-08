<script lang="ts">
  import { Link } from 'svelte-ascii-ui';

  import type { FactorProvenance } from '@/shared/lib/ranking';

  interface Props {
    provenance: FactorProvenance | undefined;
  }

  let { provenance }: Props = $props();
</script>

{#if provenance}
  <p class="text-sm text-foreground/70">
    {#if provenance.url}
      <Link href={provenance.url} target="_blank" rel="external noopener noreferrer">
        <span class="text-sm">{provenance.name}</span>
      </Link>
    {:else}
      {provenance.name}
    {/if}
    · {provenance.period}
  </p>
{/if}
