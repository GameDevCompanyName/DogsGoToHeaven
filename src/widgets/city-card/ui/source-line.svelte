<script lang="ts">
  import type { FactorProvenance } from '@/shared/lib/ranking';

  interface Props {
    provenance: FactorProvenance | undefined;
  }

  let { provenance }: Props = $props();
</script>

{#if provenance}
  <p class="text-sm text-foreground/70">
    {#if provenance.url}
      <a
        href={provenance.url}
        target="_blank"
        rel="external noopener noreferrer"
        class="underline underline-offset-2 hover:text-foreground"
      >
        {provenance.name}
      </a>
    {:else}
      {provenance.name}
    {/if}
    · {provenance.period}
  </p>
{/if}
