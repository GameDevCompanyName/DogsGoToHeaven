<script lang="ts">
  import { Button, IconButton } from 'svelte-ascii-ui';

  import { getRankingContext, MAX_COMPARE } from '@/entities/ranking';
  import type { CityId } from '@/shared/lib/ranking';

  interface Props {
    cityId: CityId;
    /** Для имени кнопки-иконки: в списке рядом десятки одинаковых «Сравнить». */
    cityName: string;
    /** Маленькая кнопка-иконка для строки списка; по умолчанию — с подписью, для карточки. */
    isCompact?: boolean;
  }

  let { cityId, cityName, isCompact = false }: Props = $props();
  const hintId = $props.id();

  const ranking = getRankingContext();

  const isPressed = $derived(ranking.compareIds.includes(cityId));
  /** Четвёртый город не добавить: кнопка гаснет, а убрать выбранный можно всегда. */
  const isDisabled = $derived(!isPressed && ranking.isCompareFull);

  function handleClick() {
    // Погасшая кнопка остаётся в фокусе, чтобы объяснение было слышно, но ничего не делает.
    if (isDisabled) return;
    ranking.toggleCompare(cityId);
  }
</script>

<!-- Выбор обозначен текстовым знаком, а не только цветом. -->
{#if isCompact}
  <IconButton
    size="s"
    label={'Сравнить: ' + cityName}
    icon={isPressed ? 'minus' : 'plus'}
    variant={isPressed ? 'primary' : 'default'}
    aria-pressed={isPressed}
    aria-disabled={isDisabled}
    aria-describedby={isDisabled ? hintId : undefined}
    data-testid="compare-toggle"
    onclick={handleClick}
  />
{:else}
  <Button
    size="s"
    variant={isPressed ? 'primary' : 'default'}
    aria-pressed={isPressed}
    aria-disabled={isDisabled}
    aria-describedby={isDisabled ? hintId : undefined}
    data-testid="compare-toggle"
    onclick={handleClick}
  >
    <span aria-hidden="true">{isPressed ? '[x]' : '[+]'}</span> Сравнить
  </Button>
{/if}
{#if isDisabled}
  <span id={hintId} class="sr-only">Сравнить можно до {MAX_COMPARE} городов</span>
{/if}
