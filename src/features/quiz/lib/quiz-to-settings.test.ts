import { describe, expect, it } from 'vitest';

import { loadRawData } from '@/shared/api';
import type { Preset } from '@/shared/lib/ranking';

import { QUIZ_QUESTIONS, type QuizAnswers } from '../config/questions';
import { quizToSettings } from './quiz-to-settings';

// Выбор персоны имеет смысл только на настоящих персонах из data/presets.json.
const RAW = loadRawData();
const PRESETS = RAW.presets;

/** Самые обычные ответы: удалёнщик на год-два, которому важно, чтобы было дёшево. */
const NEUTRAL: QuizAnswers = {
  term: 'years',
  income: 'remote-russia',
  climate: 'any',
  priority: 'cheap',
  size: 'medium',
};

describe('quizToSettings', () => {
  it('picks the long-stay remote worker for the neutral answers', () => {
    expect(quizToSettings(NEUTRAL, PRESETS).presetId).toBe('remote-long');
  });

  it('changes the result with every option of every question', () => {
    for (const question of QUIZ_QUESTIONS) {
      const results = question.options.map((option) =>
        JSON.stringify(quizToSettings({ ...NEUTRAL, [question.id]: option.id }, PRESETS)),
      );
      expect(new Set(results).size, question.id).toBe(question.options.length);
    }
  });

  it('picks the persona closest to the answers', () => {
    expect(
      quizToSettings(
        { ...NEUTRAL, term: 'forever', income: 'remote-abroad', priority: 'fast-legal' },
        PRESETS,
      ).presetId,
    ).toBe('for-good');
    expect(
      quizToSettings({ ...NEUTRAL, income: 'local-job', priority: 'fast-legal' }, PRESETS).presetId,
    ).toBe('local-career');
    expect(quizToSettings({ ...NEUTRAL, term: 'months' }, PRESETS).presetId).toBe('short-stay');
  });

  it('keeps a one-to-two-year stay off the short-stay persona and its visa filter', () => {
    const answers: QuizAnswers = {
      term: 'years',
      income: 'remote-russia',
      climate: 'warm-winter',
      priority: 'cheap',
      size: 'small',
    };

    const { presetId } = quizToSettings(answers, PRESETS);

    expect(presetId).toBe('warm-cheap');
    // Тот же ввод — та же персона: при равенстве побеждает первая в списке, случайности нет.
    expect(quizToSettings(answers, PRESETS).presetId).toBe(presetId);
  });

  it('lets the term decide the persona pool for every combination of answers', () => {
    const pools: Record<string, string[]> = {
      months: ['short-stay'],
      years: ['remote-long', 'warm-cheap', 'local-career'],
      forever: ['for-good', 'family', 'local-career'],
    };
    for (const answers of allAnswers()) {
      const { presetId } = quizToSettings(answers, PRESETS);
      expect(pools[answers.term], JSON.stringify(answers)).toContain(presetId);
    }
  });

  it('picks a settled persona for a permanent move where safety matters most', () => {
    const { presetId } = quizToSettings({ ...NEUTRAL, term: 'forever', priority: 'safe' }, PRESETS);

    expect(['family', 'for-good']).toContain(presetId);
  });

  it('asks for a warm winter with a weight and a range', () => {
    const settings = quizToSettings({ ...NEUTRAL, climate: 'warm-winter' }, PRESETS);

    expect(settings.weights['winter-temp']).toBe(9);
    expect(settings.ranges['winter-temp']).toEqual([12, 25]);
  });

  it('turns the city size on with the chosen range', () => {
    const settings = quizToSettings({ ...NEUTRAL, size: 'small' }, PRESETS);

    expect(settings.enabled.population).toBe(true);
    expect(settings.ranges.population).toEqual([0, 500_000]);
  });

  it('keeps Russia close with the time difference and direct flights to Moscow', () => {
    const settings = quizToSettings({ ...NEUTRAL, priority: 'near-russia' }, PRESETS);

    // Доход из России даёт разнице во времени 6, «поближе к России» — 8: берётся больший вес.
    expect(settings.weights['moscow-time-diff']).toBe(8);
    expect(settings.filters['direct-flights']).toEqual({ allowed: ['moscow'] });
  });

  it('switches on a factor the persona keeps off once an answer weighs it', () => {
    const settings = quizToSettings({ ...NEUTRAL, income: 'local-job' }, PRESETS);

    expect(settings.enabled['it-salary']).toBe(true);
  });

  it('falls back to the first persona without answers and to none without personas', () => {
    const presets: Preset[] = PRESETS.slice(0, 2);

    expect(quizToSettings({}, presets).presetId).toBe(presets[0]?.id);
    expect(quizToSettings(NEUTRAL, []).presetId).toBeNull();
  });

  it('only names factors and categories from the registry', () => {
    const factorsById = new Map(RAW.registry.factors.map((factor) => [factor.id, factor]));
    for (const option of QUIZ_QUESTIONS.flatMap(({ options }) => options)) {
      const { weights = {}, enabled = {}, ranges = {}, filters = {} } = option.overrides;
      for (const factorId of [weights, enabled, ranges, option.signal].flatMap(Object.keys)) {
        expect(factorsById.get(factorId)?.kind, `${option.id}: ${factorId}`).toBe('numeric');
      }
      for (const presetId of option.personas ?? []) {
        expect(
          PRESETS.map(({ id }) => id),
          `${option.id}: ${presetId}`,
        ).toContain(presetId);
      }
      for (const [factorId, filter] of Object.entries(filters)) {
        const factor = factorsById.get(factorId);
        expect(factor, `${option.id}: ${factorId}`).toBeDefined();
        if (factor?.kind === 'categorical' && 'allowed' in filter) {
          const codes = factor.categories.map(({ code }) => code);
          expect(codes).toEqual(expect.arrayContaining(filter.allowed));
        }
      }
    }
  });
});

/** Все сочетания ответов: по варианту на каждый вопрос. */
function allAnswers(): QuizAnswers[] {
  return QUIZ_QUESTIONS.reduce<Partial<QuizAnswers>[]>(
    (combos, question) =>
      combos.flatMap((combo) =>
        question.options.map((option) => ({ ...combo, [question.id]: option.id })),
      ),
    [{}],
  ).filter((combo): combo is QuizAnswers => QUIZ_QUESTIONS.every(({ id }) => id in combo));
}
