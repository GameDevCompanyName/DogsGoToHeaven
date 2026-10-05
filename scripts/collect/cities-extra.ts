/**
 * Расширение списка городов, раунд 3 (docs/superpowers/specs/2026-10-01-product-round-3-design.md,
 * часть D). Список — осознанный выбор владельца проекта, а не индекс: исторические и курортные
 * города средней величины, которые звучат в разговорах о переезде и туризме, и столицы
 * недостающих стран.
 *
 * Каждая запись — точный заголовок статьи английской Википедии (не редирект и не страница
 * неоднозначности: wbgetentities редиректы не разрешает) и ожидаемая страна (ISO 3166-1 alpha-2).
 * `slug` — id города, если он не выводится из заголовка (часть до запятой, слагифицированная).
 * Города, чей id уже есть в data/cities.json, cities-extend.ts пропускает.
 *
 * Заголовки, проверенные по API Википедии 2026-10-01: «Hội An» и «Puducherry» — страницы
 * неоднозначности, берутся «Hội An (city)» (город до реформы 2025 года, как Ha Long в cities.ts)
 * и «Pondicherry»; «San Carlos de Bariloche» — редирект на «Bariloche».
 *
 * Отступления от списка спецификации: «Мадейра» — это Фуншал, отдельной записи нет; «Ломбок» —
 * остров, берётся статья острова; добавлены столицы новых стран, которых нет в списке:
 * Вьентьян (la) и Дар-эс-Салам (tz, крупнейший город и бывшая столица, где работают посольства;
 * официальная столица Додома для переезда не значима).
 */

export interface ExtraCity {
  /** Заголовок статьи английской Википедии. */
  title: string;
  countryId: string;
  slug?: string;
}

export interface ExtraCountry {
  id: string;
  name: string;
}

export const COUNTRIES_EXTRA: ExtraCountry[] = [
  { id: 'mk', name: 'Северная Македония' },
  { id: 'al', name: 'Албания' },
  { id: 'ba', name: 'Босния и Герцеговина' },
  { id: 'md', name: 'Молдова' },
  { id: 'lk', name: 'Шри-Ланка' },
  { id: 'np', name: 'Непал' },
  { id: 'kh', name: 'Камбоджа' },
  { id: 'la', name: 'Лаос' },
  { id: 'qa', name: 'Катар' },
  { id: 'bh', name: 'Бахрейн' },
  { id: 'kw', name: 'Кувейт' },
  { id: 'jo', name: 'Иордания' },
  { id: 'tn', name: 'Тунис' },
  { id: 'ke', name: 'Кения' },
  { id: 'tz', name: 'Танзания' },
  { id: 'mu', name: 'Маврикий' },
  { id: 'sc', name: 'Сейшелы' },
  { id: 'co', name: 'Колумбия' },
  { id: 'cl', name: 'Чили' },
  { id: 'uy', name: 'Уругвай' },
  { id: 'pa', name: 'Панама' },
  { id: 'cr', name: 'Коста-Рика' },
  { id: 'do', name: 'Доминикана' },
  { id: 'ec', name: 'Эквадор' },
  { id: 'py', name: 'Парагвай' },
];

export const CITIES_EXTRA: ExtraCity[] = [
  // Европа
  { title: 'Bruges', countryId: 'be' },
  { title: 'Antwerp', countryId: 'be' },
  { title: 'Leuven', countryId: 'be' },
  { title: 'Bordeaux', countryId: 'fr' },
  { title: 'Lyon', countryId: 'fr' },
  { title: 'Marseille', countryId: 'fr' },
  { title: 'Nantes', countryId: 'fr' },
  { title: 'Montpellier', countryId: 'fr' },
  { title: 'Seville', countryId: 'es' },
  { title: 'Granada', countryId: 'es' },
  { title: 'Palma de Mallorca', countryId: 'es', slug: 'palma' },
  { title: 'Alicante', countryId: 'es' },
  { title: 'Bilbao', countryId: 'es' },
  { title: 'San Sebastián', countryId: 'es' },
  { title: 'Faro, Portugal', countryId: 'pt' },
  { title: 'Coimbra', countryId: 'pt' },
  { title: 'Funchal', countryId: 'pt' },
  { title: 'Leipzig', countryId: 'de' },
  { title: 'Dresden', countryId: 'de' },
  { title: 'Freiburg im Breisgau', countryId: 'de', slug: 'freiburg' },
  { title: 'Salzburg', countryId: 'at' },
  { title: 'Innsbruck', countryId: 'at' },
  { title: 'Lucerne', countryId: 'ch' },
  { title: 'Lugano', countryId: 'ch' },
  { title: 'Bolzano', countryId: 'it' },
  { title: 'Bologna', countryId: 'it' },
  { title: 'Turin', countryId: 'it' },
  { title: 'Naples', countryId: 'it' },
  { title: 'Palermo', countryId: 'it' },
  { title: 'Bari', countryId: 'it' },
  { title: 'Split, Croatia', countryId: 'hr' },
  { title: 'Dubrovnik', countryId: 'hr' },
  { title: 'Zadar', countryId: 'hr' },
  { title: 'Herceg Novi', countryId: 'me' },
  { title: 'Tivat', countryId: 'me' },
  { title: 'Wrocław', countryId: 'pl' },
  { title: 'Gdańsk', countryId: 'pl' },
  { title: 'Poznań', countryId: 'pl' },
  { title: 'Brno', countryId: 'cz' },
  { title: 'Ostrava', countryId: 'cz' },
  { title: 'Košice', countryId: 'sk' },
  { title: 'Debrecen', countryId: 'hu' },
  { title: 'Cluj-Napoca', countryId: 'ro' },
  { title: 'Varna, Bulgaria', countryId: 'bg' },
  { title: 'Plovdiv', countryId: 'bg' },
  { title: 'Skopje', countryId: 'mk' },
  { title: 'Ohrid', countryId: 'mk' },
  { title: 'Tirana', countryId: 'al' },
  { title: 'Sarandë', countryId: 'al' },
  { title: 'Sarajevo', countryId: 'ba' },
  { title: 'Mostar', countryId: 'ba' },
  { title: 'Chișinău', countryId: 'md' },
  { title: 'Tartu', countryId: 'ee' },
  { title: 'Turku', countryId: 'fi' },
  { title: 'Aarhus', countryId: 'dk' },
  { title: 'Malmö', countryId: 'se' },
  { title: 'Maastricht', countryId: 'nl' },

  // Азия
  { title: 'Hội An (city)', countryId: 'vn', slug: 'hoi-an' },
  { title: 'Da Lat', countryId: 'vn' },
  { title: 'Huế', countryId: 'vn' },
  { title: 'Chiang Rai', countryId: 'th' },
  { title: 'Hua Hin', countryId: 'th' },
  { title: 'Ko Samui', countryId: 'th' },
  { title: 'Ubud', countryId: 'id' },
  { title: 'Canggu', countryId: 'id' },
  { title: 'Lombok', countryId: 'id' },
  { title: 'Ipoh', countryId: 'my' },
  { title: 'Davao City', countryId: 'ph', slug: 'davao' },
  { title: 'Dumaguete', countryId: 'ph' },
  { title: 'Colombo', countryId: 'lk' },
  { title: 'Galle', countryId: 'lk' },
  { title: 'Kathmandu', countryId: 'np' },
  { title: 'Pokhara', countryId: 'np' },
  { title: 'Phnom Penh', countryId: 'kh' },
  { title: 'Siem Reap', countryId: 'kh' },
  { title: 'Vientiane', countryId: 'la' },
  { title: 'Luang Prabang', countryId: 'la' },
  { title: 'Bukhara', countryId: 'uz' },
  { title: 'Khiva', countryId: 'uz' },
  { title: 'Cholpon-Ata', countryId: 'kg' },
  { title: 'Taichung', countryId: 'tw' },
  { title: 'Kaohsiung', countryId: 'tw' },
  { title: 'Sapporo', countryId: 'jp' },
  { title: 'Nagoya', countryId: 'jp' },
  { title: 'Naha', countryId: 'jp' },
  { title: 'Panaji', countryId: 'in' },
  { title: 'Pondicherry', countryId: 'in' },
  { title: 'Kochi', countryId: 'in' },
  { title: 'Udaipur', countryId: 'in' },

  // Ближний Восток и Африка
  { title: 'Doha', countryId: 'qa' },
  { title: 'Manama', countryId: 'bh' },
  { title: 'Kuwait City', countryId: 'kw' },
  { title: 'Amman', countryId: 'jo' },
  { title: 'Tunis', countryId: 'tn' },
  { title: 'Sousse', countryId: 'tn' },
  { title: 'Cape Town', countryId: 'za' },
  { title: 'Durban', countryId: 'za' },
  { title: 'Casablanca', countryId: 'ma' },
  { title: 'Tangier', countryId: 'ma' },
  { title: 'Essaouira', countryId: 'ma' },
  { title: 'Nairobi', countryId: 'ke' },
  { title: 'Zanzibar City', countryId: 'tz', slug: 'zanzibar' },
  { title: 'Dar es Salaam', countryId: 'tz' },
  { title: 'Port Louis', countryId: 'mu' },
  { title: 'Victoria, Seychelles', countryId: 'sc', slug: 'victoria-sc' },
  { title: 'Eilat', countryId: 'il' },
  { title: 'Netanya', countryId: 'il' },

  // Америка
  { title: 'Guadalajara', countryId: 'mx' },
  { title: 'Puerto Vallarta', countryId: 'mx' },
  { title: 'Playa del Carmen', countryId: 'mx' },
  { title: 'Oaxaca City', countryId: 'mx', slug: 'oaxaca' },
  { title: 'Mérida, Yucatán', countryId: 'mx' },
  { title: 'San Miguel de Allende', countryId: 'mx' },
  { title: 'Medellín', countryId: 'co' },
  { title: 'Bogotá', countryId: 'co' },
  { title: 'Cartagena, Colombia', countryId: 'co' },
  { title: 'Santiago', countryId: 'cl' },
  { title: 'Valparaíso', countryId: 'cl' },
  { title: 'Montevideo', countryId: 'uy' },
  { title: 'Punta del Este', countryId: 'uy' },
  { title: 'Córdoba, Argentina', countryId: 'ar' },
  { title: 'Mendoza, Argentina', countryId: 'ar' },
  { title: 'Bariloche', countryId: 'ar' },
  { title: 'Florianópolis', countryId: 'br' },
  { title: 'São Paulo', countryId: 'br' },
  { title: 'Curitiba', countryId: 'br' },
  { title: 'Cusco', countryId: 'pe' },
  { title: 'Arequipa', countryId: 'pe' },
  { title: 'Panama City', countryId: 'pa' },
  { title: 'San José, Costa Rica', countryId: 'cr' },
  { title: 'Punta Cana', countryId: 'do' },
  { title: 'Santo Domingo', countryId: 'do' },
  { title: 'Quito', countryId: 'ec' },
  { title: 'Asunción', countryId: 'py' },
  { title: 'Austin, Texas', countryId: 'us' },
  { title: 'Denver', countryId: 'us' },
  { title: 'San Diego', countryId: 'us' },
  { title: 'Portland, Oregon', countryId: 'us' },
  { title: 'Montreal', countryId: 'ca' },
  { title: 'Halifax, Nova Scotia', countryId: 'ca' },
];
