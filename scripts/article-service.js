/** Чистий сервіс предметних даних. Не залежить від DOM, консолі чи початкового data.js. */
export const CATEGORY_LABELS = Object.freeze({
  civil: "Цивільна авіація",
  military: "Військова авіація",
  drones: "БПЛА та безпілотні системи",
  technologies: "Авіоніка та двигунобудування"
});
const PAYLOAD_KEYS = ["title", "category", "readingTime", "isPublished"];
const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const isValidId = (id) => Number.isSafeInteger(id) && id > 0;
const assertId = (id) => {
  if (!isValidId(id)) throw new TypeError("id має бути додатним безпечним цілим числом.");
};

export class ArticleValidationError extends Error {
  constructor(errors) {
    super("Публікація містить некоректні дані.");
    this.name = "ArticleValidationError";
    this.errors = { ...errors };
  }
}

export function normalizeTitle(value) {
  return typeof value === "string" ? value.trim().replace(/\s+/gu, " ") : "";
}

export function normalizeCategory(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

/** Нормалізує лише текст. Типи числа і boolean не перетворюються неявно. */
export function normalizeArticle(input) {
  if (!isRecord(input)) throw new TypeError("Очікується об’єкт публікації.");
  return {
    title: normalizeTitle(input.title),
    category: normalizeCategory(input.category),
    readingTime: input.readingTime,
    isPublished: input.isPublished
  };
}

/** Повертає помилки, а не друкує їх. Довжина заголовка після нормалізації — 5..120. */
export function validateArticle(input) {
  if (!isRecord(input)) return { isValid: false, errors: { input: "Очікується об’єкт публікації." } };
  const { title, category, readingTime, isPublished } = normalizeArticle(input);
  const errors = {};
  if (title.length < 5 || title.length > 120) errors.title = "Заголовок має містити від 5 до 120 символів.";
  if (!Object.hasOwn(CATEGORY_LABELS, category)) errors.category = "Оберіть одну з чотирьох категорій AeroHub.";
  if (!Number.isInteger(readingTime) || readingTime < 1 || readingTime > 60) errors.readingTime = "Час читання — ціле число від 1 до 60 хвилин.";
  if (typeof isPublished !== "boolean") errors.isPublished = "isPublished має бути boolean.";
  return { isValid: Object.keys(errors).length === 0, errors };
}

export function createArticle(input, id) {
  assertId(id);
  const result = validateArticle(input);
  if (!result.isValid) throw new ArticleValidationError(result.errors);
  return { id, ...normalizeArticle(input) };
}

/** Контракт data: масив валідних об’єктів із різними id. Під час перевірки дані не змінюються. */
function assertDataset(data) {
  if (!Array.isArray(data)) throw new TypeError("Очікується масив публікацій.");
  const ids = new Set();
  for (const article of data) {
    if (!isRecord(article) || !isValidId(article.id)) throw new TypeError("Запис має містити коректний id.");
    const result = validateArticle(article);
    if (!result.isValid) throw new ArticleValidationError(result.errors);
    if (ids.has(article.id)) throw new RangeError("id публікацій не можуть повторюватися.");
    ids.add(article.id);
  }
}

export function findArticleById(data, id) {
  assertDataset(data); assertId(id);
  return data.find((article) => article.id === id);
}

/** За категорією, станом і текстом; пустий query не обмежує вибірку. */
export function filterArticles(data, criteria = {}) {
  assertDataset(data);
  if (!isRecord(criteria)) throw new TypeError("Критерії мають бути об’єктом.");
  const allowed = ["category", "isPublished", "query"];
  if (Object.keys(criteria).some((key) => !allowed.includes(key))) throw new TypeError("Невідомий критерій фільтра.");
  const { category, isPublished, query = "" } = criteria;
  if (category !== undefined && !Object.hasOwn(CATEGORY_LABELS, normalizeCategory(category))) throw new RangeError("Невідома категорія.");
  if (isPublished !== undefined && typeof isPublished !== "boolean") throw new TypeError("Стан публікації має бути boolean.");
  if (typeof query !== "string") throw new TypeError("Пошуковий запит має бути рядком.");
  const categoryKey = normalizeCategory(category);
  const term = normalizeTitle(query).toLocaleLowerCase("uk");
  return data.filter((article) =>
    (category === undefined || normalizeCategory(article.category) === categoryKey) &&
    (isPublished === undefined || article.isPublished === isPublished) &&
    normalizeTitle(article.title).toLocaleLowerCase("uk").includes(term)
  );
}

function assertDirection(direction) {
  if (direction !== "asc" && direction !== "desc") throw new RangeError("Напрям сортування — asc або desc.");
}

export function sortArticlesByTitle(data, direction = "asc") {
  assertDataset(data); assertDirection(direction);
  const sign = direction === "asc" ? 1 : -1;
  return [...data].sort((a, b) => sign * (a.title.localeCompare(b.title, "uk") || a.id - b.id));
}

export function sortArticlesByReadingTime(data, direction = "asc") {
  assertDataset(data); assertDirection(direction);
  const sign = direction === "asc" ? 1 : -1;
  return [...data].sort((a, b) => sign * (a.readingTime - b.readingTime || a.id - b.id));
}

export function toArticlePreview(article) {
  assertDataset([article]);
  const { id, title, category, readingTime, isPublished } = article;
  return { id, title, categoryLabel: CATEGORY_LABELS[normalizeCategory(category)], readingLabel: `${readingTime} хв`, isPublished };
}

export function getArticlePreviews(data) {
  assertDataset(data);
  return data.map(toArticlePreview);
}

export function summarizeArticles(data) {
  assertDataset(data);
  const initial = {
    total: 0, published: 0, drafts: 0, totalReadingTime: 0,
    byCategory: Object.fromEntries(Object.keys(CATEGORY_LABELS).map((key) => [key, 0]))
  };
  const result = data.reduce((summary, { category, readingTime, isPublished }) => ({
    ...summary,
    total: summary.total + 1,
    published: summary.published + Number(isPublished),
    drafts: summary.drafts + Number(!isPublished),
    totalReadingTime: summary.totalReadingTime + readingTime,
    byCategory: { ...summary.byCategory, [normalizeCategory(category)]: summary.byCategory[normalizeCategory(category)] + 1 }
  }), initial);
  return { ...result, averageReadingTime: result.total === 0 ? 0 : Number((result.totalReadingTime / result.total).toFixed(2)) };
}

export function hasDrafts(data) {
  assertDataset(data);
  return data.some((article) => !article.isPublished);
}

export function everyArticlePublished(data) {
  assertDataset(data);
  return data.every((article) => article.isPublished);
}

export function addArticle(data, newArticle) {
  assertDataset(data);
  if (!isRecord(newArticle)) throw new TypeError("Очікується об’єкт публікації.");
  const created = createArticle(newArticle, newArticle.id);
  if (data.some((article) => article.id === created.id)) throw new RangeError("Публікація з таким id вже існує.");
  return [...data, created];
}

export function updateArticle(data, id, changes) {
  assertDataset(data); assertId(id);
  if (!isRecord(changes)) throw new TypeError("Зміни мають бути об’єктом.");
  if (Object.keys(changes).some((key) => !PAYLOAD_KEYS.includes(key))) throw new TypeError("Дозволено змінювати лише title, category, readingTime, isPublished; id незмінний.");
  const original = data.find((article) => article.id === id);
  if (original === undefined) throw new RangeError("Публікацію для оновлення не знайдено.");
  const updated = createArticle({ ...original, ...changes }, id);
  return data.map((article) => article.id === id ? updated : article);
}

export function removeArticle(data, id) {
  assertDataset(data); assertId(id);
  if (!data.some((article) => article.id === id)) throw new RangeError("Публікацію для видалення не знайдено.");
  return data.filter((article) => article.id !== id);
}
