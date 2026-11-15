<script lang="ts">
  import { Link } from 'svelte-ascii-ui';

  import { PersonaCard } from '@/entities/preset';
  import { loadRawData } from '@/shared/api';
  import { markOnboarded } from '@/shared/lib/onboarding';
  import { pluralize } from '@/shared/lib/plural';
  import { resolve } from '$app/paths';

  const raw = loadRawData();
  const cityCount = raw.cities.length;
  const home = resolve('/');
  const quiz = resolve('/quiz');

  function handleEnter() {
    markOnboarded();
  }
</script>

<main class="mx-auto flex min-h-dvh max-w-3xl flex-col gap-8 px-4 py-8 md:py-16">
  <header class="flex flex-col gap-3">
    <h1 class="text-2xl leading-tight font-semibold md:text-3xl">Все псы попадают в рай</h1>
    <p class="text-base leading-relaxed text-foreground/80">
      Найдите несколько городов для переезда и сравните, во что обойдётся жизнь, какой там климат и
      что нужно уточнить перед решением. В базе {cityCount}
      {pluralize(cityCount, ['город', 'города', 'городов'])}. Контекст — граждане РФ; условия
      проживания проверяются отдельно.
    </p>
  </header>

  <section class="flex flex-col items-start gap-3" aria-label="Начать подбор">
    <Link href={home} button data-testid="skip-onboarding" onclick={handleEnter}
      >Смотреть города</Link
    >
    <Link href={quiz} button class="w-fit" data-testid="start-quiz">
      Помочь с выбором — 5 вопросов
    </Link>
    <p class="text-sm leading-relaxed text-muted-foreground">
      Можно сразу открыть подборку, найти знакомый город и изменить условия. Неизвестные данные
      отмечены явно, источники доступны в подробностях.
    </p>
  </section>
  <details class="border-t border-dashed border-border pt-4">
    <summary class="cursor-pointer py-2 font-semibold">Готовые примеры подбора</summary>
    <p class="my-3 text-sm leading-relaxed text-muted-foreground">
      Это стартовые сценарии, а не проверка всех обстоятельств переезда. После выбора любые условия
      можно изменить.
    </p>
    <ul class="grid gap-3 md:grid-cols-2">
      {#each raw.presets as preset (preset.id)}
        <li>
          <PersonaCard {preset} href="{home}#p={preset.id}" onselect={handleEnter} />
        </li>
      {/each}
    </ul>
  </details>
</main>
