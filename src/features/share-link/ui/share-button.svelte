<script lang="ts">
  import CheckIcon from '@lucide/svelte/icons/check';
  import LinkIcon from '@lucide/svelte/icons/link';
  import { onDestroy } from 'svelte';

  import { getRankingContext } from '@/entities/ranking';
  import { Button } from '@/shared/ui/button';
  import { Input } from '@/shared/ui/input';

  /** Сколько держится подтверждение после копирования. */
  const FEEDBACK_MS = 2000;

  const ranking = getRankingContext();

  let feedbackTimer: ReturnType<typeof setTimeout> | undefined;

  let status = $state<'idle' | 'copied' | 'failed'>('idle');
  /** Адрес, который не удалось скопировать: показываем его в поле, чтобы скопировать руками. */
  let manualUrl = $state<string | null>(null);

  const label = $derived(
    status === 'copied' ? 'Скопировано' : status === 'failed' ? 'Не удалось' : 'Поделиться',
  );

  async function handleClick() {
    // Адрес собираем из состояния, а не из строки браузера: та обновляется с задержкой.
    const hash = ranking.urlHash;
    const url = `${location.origin}${location.pathname}${hash ? `#${hash}` : ''}`;
    clearTimeout(feedbackTimer);
    try {
      await navigator.clipboard.writeText(url);
      status = 'copied';
      manualUrl = null;
      feedbackTimer = setTimeout(() => (status = 'idle'), FEEDBACK_MS);
    } catch {
      status = 'failed';
      manualUrl = url;
    }
  }

  function handleManualClose() {
    status = 'idle';
    manualUrl = null;
  }

  function handleManualKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') handleManualClose();
  }

  /** Поле с адресом сразу в фокусе и выделено: остаётся нажать «Копировать». */
  function selectAll(input: HTMLInputElement) {
    input.focus();
    input.select();
  }

  onDestroy(() => clearTimeout(feedbackTimer));
</script>

<div class="relative">
  <Button variant="outline" size="sm" data-testid="share-button" onclick={handleClick}>
    {#if status === 'copied'}
      <CheckIcon aria-hidden="true" />
    {:else}
      <LinkIcon aria-hidden="true" />
    {/if}
    <span aria-live="polite">{label}</span>
  </Button>
  {#if manualUrl !== null}
    <label
      class="absolute top-full right-0 z-30 mt-2 flex w-72 max-w-[calc(100vw-2rem)] flex-col gap-1.5 rounded-md border bg-background p-3 text-sm text-foreground/70 shadow-md"
      data-testid="share-manual"
    >
      Скопируйте ссылку вручную
      <Input
        readonly
        value={manualUrl}
        {@attach selectAll}
        onblur={handleManualClose}
        onkeydown={handleManualKeydown}
      />
    </label>
  {/if}
</div>
