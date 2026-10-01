<script lang="ts">
  import { PersonaCard } from '@/entities/preset';
  import { loadRawData } from '@/shared/api';
  import { markOnboarded } from '@/shared/lib/onboarding';
  import { pluralize } from '@/shared/lib/plural';
  import { resolve } from '$app/paths';

  const raw = loadRawData();
  const cityCount = raw.cities.length;
  const home = resolve('/');

  function handleEnter() {
    markOnboarded();
  }
</script>

<main class="mx-auto flex min-h-dvh max-w-3xl flex-col gap-8 px-4 py-8 md:py-16">
  <header class="flex flex-col gap-3">
    <h1 class="text-2xl leading-tight font-semibold md:text-3xl">Все псы попадают в рай</h1>
    <p class="text-base leading-relaxed text-foreground/80">
      Помогаем выбрать город для переезда под ваши приоритеты. {cityCount}
      {pluralize(cityCount, ['город', 'города', 'городов'])} сравниваются по деньгам, легализации, климату,
      безопасности и связи с домом, а балл пересчитывается сразу, как только вы двигаете ползунки. Данные
      честные: у каждого числа есть источник и дата, а где данных нет, так и написано.
    </p>
  </header>

  <section aria-labelledby="start-personas" class="flex flex-col gap-3">
    <div class="flex flex-col gap-1">
      <h2 id="start-personas" class="text-lg font-semibold">Кто вы?</h2>
      <p class="text-sm text-foreground/70">
        Выберите, что ближе, — веса факторов подстроятся. Потом их можно поменять.
      </p>
    </div>
    <ul class="grid gap-3 md:grid-cols-2">
      {#each raw.presets as preset (preset.id)}
        <li>
          <PersonaCard {preset} href="{home}#p={preset.id}" onselect={handleEnter} />
        </li>
      {/each}
    </ul>
  </section>

  <a
    href={home}
    class="w-fit font-medium underline underline-offset-4"
    data-testid="skip-onboarding"
    onclick={handleEnter}
  >
    Открыть карту без выбора
  </a>
</main>
