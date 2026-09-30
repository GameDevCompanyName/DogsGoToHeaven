/** Флаг в `localStorage`: человек уже видел лендинг или пришёл по ссылке с настройками. */
const ONBOARDED_KEY = 'dogs:onboarded';

/**
 * Прошёл ли человек лендинг. Без доступа к хранилищу (приватный режим, запрет cookie) считаем,
 * что прошёл: иначе главная уводила бы на лендинг по кругу.
 */
export function isOnboarded(): boolean {
  try {
    return localStorage.getItem(ONBOARDED_KEY) === '1';
  } catch {
    return true;
  }
}

export function markOnboarded(): void {
  try {
    localStorage.setItem(ONBOARDED_KEY, '1');
  } catch {
    // Хранилище недоступно: isOnboarded() в этом случае и так не уводит на лендинг.
  }
}
