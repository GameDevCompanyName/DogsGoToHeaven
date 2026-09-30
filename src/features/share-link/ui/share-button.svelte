<script lang="ts">
  import CheckIcon from '@lucide/svelte/icons/check';
  import LinkIcon from '@lucide/svelte/icons/link';

  import { getRankingContext } from '@/entities/ranking';
  import { Button } from '@/shared/ui/button';

  /** Сколько держится подтверждение после копирования. */
  const FEEDBACK_MS = 2000;

  const ranking = getRankingContext();

  let status = $state<'idle' | 'copied' | 'failed'>('idle');
  let feedbackTimer: ReturnType<typeof setTimeout> | undefined;

  const label = $derived(
    status === 'copied' ? 'Скопировано' : status === 'failed' ? 'Не удалось' : 'Поделиться',
  );

  async function handleClick() {
    // Адрес собираем из состояния, а не из строки браузера: та обновляется с задержкой.
    const url = `${location.origin}${location.pathname}#${ranking.urlHash}`;
    try {
      await navigator.clipboard.writeText(url);
      status = 'copied';
    } catch {
      status = 'failed';
    }
    clearTimeout(feedbackTimer);
    feedbackTimer = setTimeout(() => (status = 'idle'), FEEDBACK_MS);
  }
</script>

<Button variant="outline" size="sm" data-testid="share-button" onclick={handleClick}>
  {#if status === 'copied'}
    <CheckIcon aria-hidden="true" />
  {:else}
    <LinkIcon aria-hidden="true" />
  {/if}
  <span aria-live="polite">{label}</span>
</Button>
