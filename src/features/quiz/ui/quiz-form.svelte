<script lang="ts">
  import { Button, Link, Progress } from 'svelte-ascii-ui';

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
  /** Вперёд пускает только ответ, поэтому все вопросы до текущего отвечены. */
  const answered = $derived(step);

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
    <Progress value={answered / total} label="Пройдено вопросов" size="s" />
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
            <Button
              fullWidth
              aria-pressed={isChosen}
              data-testid="quiz-option"
              variant={isChosen ? 'primary' : 'default'}
              onclick={() => handleAnswer(option.id)}
            >
              {#if isChosen}<span aria-hidden="true">[x] </span>{/if}
              {option.label}
            </Button>
          {/each}
        </div>
      </section>
    {/key}
  {/if}

  <div class="w-fit">
    {#if step === 0}
      <Link href={exitHref}>← Назад</Link>
    {:else}
      <Button size="s" onclick={handleBack}>← Назад</Button>
    {/if}
  </div>
</div>
