<script lang="ts">
  import CheckIcon from '@lucide/svelte/icons/check';
  import ScaleIcon from '@lucide/svelte/icons/scale';

  import { getRankingContext, MAX_COMPARE } from '@/entities/ranking';
  import type { CityId } from '@/shared/lib/ranking';
  import { cn } from '@/shared/lib/utils';
  import { Button } from '@/shared/ui/button';

  interface Props {
    cityId: CityId;
    /** Маленькая кнопка-иконка для строки списка; по умолчанию — с подписью, для карточки. */
    isCompact?: boolean;
  }

  let { cityId, isCompact = false }: Props = $props();

  const ranking = getRankingContext();

  const isPressed = $derived(ranking.compareIds.includes(cityId));
  /** Четвёртый город не добавить: кнопка гаснет, а убрать выбранный можно всегда. */
  const isDisabled = $derived(!isPressed && ranking.isCompareFull);

  function handleClick() {
    ranking.toggleCompare(cityId);
  }
</script>

<!-- Нажатое состояние видно не только цветом: иконка весов сменяется галочкой. -->
<Button
  variant={isPressed ? 'secondary' : isCompact ? 'ghost' : 'outline'}
  size={isCompact ? 'icon-sm' : 'sm'}
  aria-pressed={isPressed}
  aria-label={isCompact ? 'Сравнить' : undefined}
  title={isDisabled ? `Сравнить можно до ${MAX_COMPARE} городов` : 'Сравнить'}
  disabled={isDisabled}
  data-testid="compare-toggle"
  class={cn(isPressed && 'ring-1 ring-foreground')}
  onclick={handleClick}
>
  {#if isPressed}
    <CheckIcon aria-hidden="true" />
  {:else}
    <ScaleIcon aria-hidden="true" />
  {/if}
  {#if !isCompact}
    Сравнить
  {/if}
</Button>
