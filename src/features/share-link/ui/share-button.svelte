<script lang="ts">
  import { onDestroy } from 'svelte';
  import { Button, Input, Panel } from 'svelte-ascii-ui';

  import { getRankingContext } from '@/entities/ranking';
  import { cn } from '@/shared/lib/utils';

  interface Props {
    /** Скрыть подпись до результата копирования. */
    isCompact?: boolean;
    /** Положение панели ручного копирования относительно кнопки. */
    align?: 'start' | 'end';
  }

  let { isCompact = false, align = 'end' }: Props = $props();

  /** Сколько держится подтверждение после копирования. */
  const FEEDBACK_MS = 2000;

  const ranking = getRankingContext();

  let feedbackTimer: ReturnType<typeof setTimeout> | undefined;

  let status = $state<'idle' | 'copied' | 'failed'>('idle');
  /** Адрес, который не удалось скопировать: показываем его в поле, чтобы скопировать руками. */
  let manualUrl = $state<string | null>(null);

  const isIconOnly = $derived(isCompact && status === 'idle');
  const label = $derived(
    status === 'copied' ? 'Скопировано' : status === 'failed' ? 'Не удалось' : 'Поделиться',
  );

  async function handleClick() {
    // Адрес собираем из состояния, а не из строки браузера: та обновляется с задержкой.
    // В карточке города хеш уже несёт `c=<город>`, поэтому ссылка откроет его же.
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
  <Button size="s" title="Скопировать ссылку" data-testid="share-button" onclick={handleClick}>
    {#snippet icon()}<span>{status === 'copied' ? '✓' : '↗'}</span>{/snippet}
    <span class={cn(isIconOnly && 'sr-only')}>{label}</span>
  </Button>
  <span class="sr-only" role="status">{status === 'idle' ? '' : label}</span>
  {#if manualUrl !== null}
    <div
      class={cn(
        'absolute top-full z-30 mt-2 w-72 max-w-[calc(100vw-2rem)] bg-background',
        align === 'start' ? 'left-0' : 'right-0',
      )}
      data-testid="share-manual"
    >
      <Panel size="s">
        <label class="flex flex-col gap-3 text-sm">
          Скопируйте ссылку вручную
          <Input
            size="s"
            readonly
            value={manualUrl}
            {@attach selectAll}
            onblur={handleManualClose}
            onkeydown={handleManualKeydown}
          />
        </label>
      </Panel>
    </div>
  {/if}
</div>
