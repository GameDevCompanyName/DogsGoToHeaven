<script lang="ts" module>
  const PREFERENCES = [
    { id: 'cheap', label: 'Меньше тратить', factors: ['cost-of-living', 'rent'] },
    { id: 'safe', label: 'Безопасность', factors: ['safety'] },
    { id: 'warm', label: 'Мягкая зима', factors: ['winter-temp'] },
    { id: 'legal', label: 'Проще легализоваться', factors: ['legalization-ease'] },
  ];
</script>

<script lang="ts">
  import { Button, Checkbox, Field, Input } from 'svelte-ascii-ui';

  import { getRankingContext } from '@/entities/ranking';

  import { limitError, setIncomeMode, setLimit, setPreference } from '../lib/preferences';

  const ranking = getRankingContext();
  const id = $props.id();
  let errors = $state<Record<string, string>>({});
  const isLocalIncome = $derived(ranking.settings.enabled['it-salary'] === true);
  const rentalFilter = $derived(ranking.settings.filters.rent);
  const rentMax = $derived(
    rentalFilter && !('allowed' in rentalFilter) ? rentalFilter.max : undefined,
  );
  const winterFilter = $derived(ranking.settings.filters['winter-temp']);
  const winterMin = $derived(
    winterFilter && !('allowed' in winterFilter) ? winterFilter.min : undefined,
  );

  function isPreferred(factors: string[]): boolean {
    return factors.every(
      (factor) => ranking.settings.enabled[factor] && (ranking.settings.weights[factor] ?? 0) >= 8,
    );
  }

  function handlePreference(factors: string[], isSelected: boolean) {
    ranking.settings = setPreference(ranking.settings, factors, isSelected);
    if (isSelected && factors.includes('winter-temp')) ranking.setRange('winter-temp', [8, 25]);
  }

  function handleLimit(factor: string, bound: 'min' | 'max', raw: string) {
    const normalized = raw.replace(/\s/g, '').replace(',', '.').replace('−', '-');
    const value = normalized === '' ? undefined : Number(normalized);
    const error = limitError(ranking.settings, factor, bound, value);
    if (error) {
      errors[factor] = error;
      return;
    }
    delete errors[factor];
    ranking.settings = setLimit(ranking.settings, factor, bound, value);
  }
  export function validate(): boolean {
    const invalidFactor = Object.keys(errors)[0];
    if (!invalidFactor) return true;
    document.getElementById(`${id}-${invalidFactor}`)?.focus();
    return false;
  }
</script>

<div class="flex flex-col gap-6" data-testid="simple-preferences">
  <fieldset class="flex flex-col gap-2">
    <legend class="mb-2 text-base font-semibold">Как будете зарабатывать?</legend>
    <div class="grid grid-cols-2 gap-2">
      <Button
        size="s"
        aria-pressed={!isLocalIncome}
        variant={!isLocalIncome ? 'primary' : 'default'}
        onclick={() => (ranking.settings = setIncomeMode(ranking.settings, 'remote'))}
        >Удалённо</Button
      >
      <Button
        size="s"
        aria-pressed={isLocalIncome}
        variant={isLocalIncome ? 'primary' : 'default'}
        onclick={() => (ranking.settings = setIncomeMode(ranking.settings, 'local'))}
        >На месте в IT</Button
      >
    </div>
    {#if isLocalIncome}
      <p class="text-sm leading-relaxed text-muted-foreground">
        Зарплаты помогают сравнить города. Наличие вакансий и доступность рабочей визы пока не
        проверяем.
      </p>
    {/if}
  </fieldset>

  <fieldset class="flex flex-col gap-2">
    <legend class="mb-2 text-base font-semibold">Что для вас особенно важно?</legend>
    {#each PREFERENCES as preference (preference.id)}
      <Checkbox
        size="s"
        label={preference.label}
        bind:checked={
          () => isPreferred(preference.factors),
          (checked) => handlePreference(preference.factors, checked)
        }
      />
    {/each}
    <p class="text-sm leading-relaxed text-muted-foreground">
      Предпочтения меняют порядок городов. Обязательные ограничения задаются ниже.
    </p>
  </fieldset>

  <section class="flex flex-col gap-3" aria-labelledby="{id}-limits">
    <h2 id="{id}-limits" class="text-base font-semibold">Без этого не подойдёт</h2>
    <p class="text-sm leading-relaxed text-muted-foreground">
      Необязательно заполнять. Если данных для проверки нет, покажем город отдельно.
    </p>
    <Field
      label="Аренда не дороже, $/мес"
      id="{id}-rent"
      hint="Оценка из датасета, не цена конкретной квартиры"
      error={errors.rent}
    >
      {#snippet children(control)}
        <Input
          {...control}
          size="s"
          inputmode="numeric"
          pattern="[0-9]*"
          placeholder="Например, 900"
          value={rentMax === undefined ? '' : String(rentMax)}
          onchange={(event) => handleLimit('rent', 'max', event.currentTarget.value)}
          data-testid="quick-rent-max"
        />
      {/snippet}
    </Field>
    <Field
      label="Зимой не холоднее, °C"
      id="{id}-winter-temp"
      hint="Средняя температура самого холодного месяца"
      error={errors['winter-temp']}
    >
      {#snippet children(control)}
        <Input
          {...control}
          size="s"
          inputmode="text"
          placeholder="Например, 0 или −5"
          value={winterMin === undefined ? '' : String(winterMin)}
          onchange={(event) =>
            handleLimit('winter-temp', 'min', event.currentTarget.value.replace('−', '-'))}
          data-testid="quick-winter-min"
        />
      {/snippet}
    </Field>
  </section>
</div>
