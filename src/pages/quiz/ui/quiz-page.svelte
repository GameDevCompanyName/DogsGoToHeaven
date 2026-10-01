<script lang="ts">
  import { EMPTY_URL_STATE, serializeState } from '@/entities/ranking';
  import { type QuizAnswers, QuizForm, quizToSettings } from '@/features/quiz';
  import { loadRawData } from '@/shared/api';
  import { markOnboarded } from '@/shared/lib/onboarding';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';

  const presets = loadRawData().presets;
  const home = resolve('/');
  const start = resolve('/start');

  /** Персона и правки ответов уходят в хеш главной: та же ссылка, какой делятся. */
  function handleFinish(answers: QuizAnswers) {
    const hash = serializeState({ ...EMPTY_URL_STATE, ...quizToSettings(answers, presets) });
    markOnboarded();
    // Путь собран через resolve() выше, к нему добавляется только хеш с настройками.
    // eslint-disable-next-line svelte/no-navigation-without-resolve
    void goto(`${home}#${hash}`);
  }
</script>

<main class="mx-auto flex min-h-dvh max-w-xl flex-col gap-8 px-4 py-8 md:py-16">
  <header class="flex flex-col gap-2">
    <h1 class="text-2xl leading-tight font-semibold md:text-3xl">Подберём настройки</h1>
    <p class="text-base leading-relaxed text-foreground/80">
      Пять коротких вопросов — и карта откроется с подходящей персоной. Потом всё можно поменять.
    </p>
  </header>
  <QuizForm exitHref={start} onfinish={handleFinish} />
</main>
