<script lang="ts">
  import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
  import CheckIcon from '@lucide/svelte/icons/check';

  import { cn } from '@/shared/lib/utils';

  import { QUIZ_QUESTIONS, type QuizAnswers } from '../config/questions';

  interface Props {
    /** Куда ведёт «Назад» с первого вопроса; собирает вызывающий код через resolve(). */
    exitHref: string;
    /** Ответ на последний вопрос: все пять ответов. */
    onfinish: (answers: QuizAnswers) => void;
  }

  let { exitHref, onfinish }: Props = $props();

  const total = QUIZ_QUESTIONS.length;
  /** Фокус на заголовок переводим только после ответа или «Назад», не при открытии страницы. */
  let hasMoved = false;

  let step = $state(0);
  let answers = $state<Partial<QuizAnswers>>({});

  const question = $derived(QUIZ_QUESTIONS[step]);
  const progress = $derived(((step + 1) / total) * 100);

  function isComplete(partial: Partial<QuizAnswers>): partial is QuizAnswers {
    return QUIZ_QUESTIONS.every(({ id }) => partial[id] !== undefined);
  }

  function handleAnswer(optionId: string) {
    if (!question) return;
    answers[question.id] = optionId;
    if (step < total - 1) {
      hasMoved = true;
      step += 1;
      return;
    }
    const snapshot = { ...answers };
    if (isComplete(snapshot)) onfinish(snapshot);
  }

  function handleBack() {
    hasMoved = true;
    step -= 1;
  }

  /** Новый вопрос — новый заголовок: скринридер и клавиатура начинают с него. */
  function focusOnMount(node: HTMLElement) {
    if (hasMoved) node.focus();
  }
</script>

<div class="flex flex-col gap-6" data-testid="quiz">
  <div class="flex flex-col gap-2">
    <p class="text-sm text-foreground/70" data-testid="quiz-progress">
      Вопрос {step + 1} из {total}
    </p>
    <div
      class="h-2 overflow-hidden rounded-full bg-muted"
      role="progressbar"
      aria-label="Пройдено вопросов"
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={step + 1}
    >
      <div
        class="h-full rounded-full bg-foreground transition-[width]"
        style:width="{progress}%"
      ></div>
    </div>
  </div>

  {#if question}
    {#key question.id}
      <section class="flex flex-col gap-4" aria-labelledby="quiz-question">
        <h2
          id="quiz-question"
          tabindex="-1"
          class="text-xl leading-tight font-semibold outline-none md:text-2xl"
          {@attach focusOnMount}
        >
          {question.title}
        </h2>
        <div class="flex flex-col gap-3">
          {#each question.options as option (option.id)}
            {@const isChosen = answers[question.id] === option.id}
            <button
              type="button"
              aria-pressed={isChosen}
              data-testid="quiz-option"
              class={cn(
                'flex min-h-14 w-full items-center gap-2 rounded-lg border px-4 py-3 text-left text-base font-medium transition-colors hover:bg-muted',
                isChosen && 'border-foreground bg-muted ring-1 ring-foreground',
              )}
              onclick={() => handleAnswer(option.id)}
            >
              {#if isChosen}
                <CheckIcon class="size-5 shrink-0" aria-hidden="true" />
              {/if}
              {option.label}
            </button>
          {/each}
        </div>
      </section>
    {/key}
  {/if}

  {#snippet backLabel()}
    <ArrowLeftIcon class="size-4" aria-hidden="true" />
    Назад
  {/snippet}
  {#if step === 0}
    <!-- eslint-disable svelte/no-navigation-without-resolve -- exitHref собирает вызывающий код через resolve() -->
    <a href={exitHref} class="inline-flex w-fit items-center gap-1.5 py-2 font-medium">
      {@render backLabel()}
    </a>
    <!-- eslint-enable svelte/no-navigation-without-resolve -->
  {:else}
    <button
      type="button"
      class="inline-flex w-fit items-center gap-1.5 py-2 font-medium"
      onclick={handleBack}
    >
      {@render backLabel()}
    </button>
  {/if}
</div>
