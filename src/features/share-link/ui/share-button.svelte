<script lang="ts">
  import CheckIcon from '@lucide/svelte/icons/check';
  import LinkIcon from '@lucide/svelte/icons/link';
  import { onDestroy } from 'svelte';

  import { getRankingContext } from '@/entities/ranking';
  import { cn } from '@/shared/lib/utils';
  import { Button } from '@/shared/ui/button';
  import { Input } from '@/shared/ui/input';

  interface Props {
    /**
     * Кнопка-иконка для карточки города: подпись видна только после нажатия. Стоит в начале
     * ряда, поэтому поле для ручного копирования выравнивается по её левому краю.
     */
    isCompact?: boolean;
  }

  let { isCompact = false }: Props = $props();

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
  <Button
    variant="outline"
    size={isIconOnly ? 'icon-sm' : 'sm'}
    title="Скопировать ссылку"
    data-testid="share-button"
    onclick={handleClick}
  >
    {#if status === 'copied'}
      <CheckIcon aria-hidden="true" />
    {:else}
      <LinkIcon aria-hidden="true" />
    {/if}
    <span aria-live="polite" class={cn(isIconOnly && 'sr-only')}>{label}</span>
  </Button>
  {#if manualUrl !== null}
    <label
      class={cn(
        'absolute top-full z-30 mt-2 flex w-72 max-w-[calc(100vw-2rem)] flex-col gap-1.5 rounded-md border bg-background p-3 text-sm text-foreground/70 shadow-md',
        isCompact ? 'left-0' : 'right-0',
      )}
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
