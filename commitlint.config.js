export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // data — коммиты сборщиков датасета: `data(<factorId>): add <source> sample`, см. docs/collect.md.
    'type-enum': [2, 'always', ['feat', 'fix', 'refactor', 'test', 'docs', 'chore', 'ci', 'data']],
  },
};
