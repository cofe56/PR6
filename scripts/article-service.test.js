import assert from "node:assert/strict";
import { articles } from "./data.js";
import * as service from "./article-service.js";

let passed = 0;
function check(label, run) {
  run();
  passed += 1;
  console.log(`PASS ${String(passed).padStart(2, "0")} ${label}`);
}
const payload = { title: "Тестова публікація", category: "civil", readingTime: 3, isPublished: false };
const frozen = Object.freeze(articles.map((article) => Object.freeze({ ...article })));
const snapshot = JSON.stringify(frozen);

check("Набір містить 8 коректних записів з унікальними id", () => {
  assert.equal(articles.length, 8);
  assert.equal(new Set(articles.map(({ id }) => id)).size, 8);
  assert(articles.every((article) => service.validateArticle(article).isValid));
});
check("Нормалізація пробілів, табуляції та перенесення", () => assert.equal(service.normalizeTitle(" \tСвіт\n авіації   AeroHub  "), "Світ авіації AeroHub"));
check("Некоректний тип заголовка нормалізується до порожнього рядка", () => assert.equal(service.normalizeTitle(null), ""));
check("Нормалізація категорії", () => assert.equal(service.normalizeCategory(" DRONES "), "drones"));
check("Неправильний тип категорії нормалізується до порожнього рядка", () => assert.equal(service.normalizeCategory(1), ""));
check("Успішна валідація і false як коректний boolean", () => assert.deepEqual(service.validateArticle(payload), { isValid: true, errors: {} }));
check("Null і масив не є об’єктами публікації", () => {
  assert.equal(service.validateArticle(null).isValid, false);
  assert.equal(service.validateArticle([]).isValid, false);
});
check("Помилки повертаються за полями", () => {
  const result = service.validateArticle({ title: " ", category: "space", readingTime: 0, isPublished: "false" });
  assert.equal(result.isValid, false);
  assert.deepEqual(Object.keys(result.errors), ["title", "category", "readingTime", "isPublished"]);
});
check("Нижня межа заголовка: 5 дозволено, 4 відхилено", () => {
  assert(service.validateArticle({ ...payload, title: "Літак" }).isValid);
  assert(!service.validateArticle({ ...payload, title: "Аеро" }).isValid);
});
check("Верхня межа заголовка: 120 дозволено, 121 відхилено", () => {
  assert(service.validateArticle({ ...payload, title: "А".repeat(120) }).isValid);
  assert(!service.validateArticle({ ...payload, title: "А".repeat(121) }).isValid);
});
check("Обидві межі часу читання: 1 і 60", () => {
  assert(service.validateArticle({ ...payload, readingTime: 1 }).isValid);
  assert(service.validateArticle({ ...payload, readingTime: 60 }).isValid);
});
check("0, 61, дроби, NaN, Infinity і рядок не є часом читання", () => {
  for (const readingTime of [0, 61, 1.5, NaN, Infinity, "5"]) assert(!service.validateArticle({ ...payload, readingTime }).isValid);
});
check("Категорія __proto__ не проходить валідацію", () => assert(!service.validateArticle({ ...payload, category: "__proto__" }).isValid));
check("create нормалізує, фільтрує зайві поля та використовує явний id", () => {
  const input = { ...payload, id: 900, extra: true, title: "  Нова   стаття ", category: " CIVIL " };
  const created = service.createArticle(input, 9);
  assert.deepEqual(created, { id: 9, title: "Нова стаття", category: "civil", readingTime: 3, isPublished: false });
  assert.equal(input.title, "  Нова   стаття ");
});
check("create повертає структуровані помилки через ArticleValidationError", () => {
  assert.throws(() => service.createArticle({ ...payload, readingTime: 0 }, 9), (error) => error instanceof service.ArticleValidationError && Boolean(error.errors.readingTime));
});
check("Некоректні id не приймаються", () => {
  for (const id of [0, -1, 1.5, "1", Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => service.createArticle(payload, id), TypeError);
});
check("find знаходить перший запис, а не губить індекс 0", () => assert.equal(service.findArticleById(frozen, 1), frozen[0]));
check("Відсутній id повертає undefined", () => assert.equal(service.findArticleById(frozen, 99), undefined));
check("Фільтр категорії має результат", () => assert.deepEqual(service.filterArticles(frozen, { category: " DRONES " }).map(({ id }) => id), [2, 6]));
check("Комбінований фільтр category + isPublished", () => assert.deepEqual(service.filterArticles(frozen, { category: "technologies", isPublished: false }).map(({ id }) => id), [7]));
check("Коректні критерії без збігів дають порожній масив", () => assert.deepEqual(service.filterArticles(frozen, { category: "drones", isPublished: false }), []));
check("Текстовий пошук без урахування українського регістру", () => assert.deepEqual(service.filterArticles(frozen, { query: "  бЕзПіЛоТнИкИ " }).map(({ id }) => id), [2]));
check("Порожній пошук повертає всі записи новим масивом", () => {
  const result = service.filterArticles(frozen, { query: "  " });
  assert.deepEqual(result, frozen); assert.notEqual(result, frozen);
});
check("Некоректні або невідомі критерії явно відхиляються", () => {
  assert.throws(() => service.filterArticles(frozen, { category: "unknown" }), RangeError);
  assert.throws(() => service.filterArticles(frozen, { isPublished: "false" }), TypeError);
  assert.throws(() => service.filterArticles(frozen, { query: 0 }), TypeError);
  assert.throws(() => service.filterArticles(frozen, { typo: true }), TypeError);
});
check("map створює короткі представлення та labels", () => {
  const previews = service.getArticlePreviews(frozen);
  assert.equal(previews.length, 8);
  assert.equal(previews[0].readingLabel, "5 хв");
  assert.equal(previews[0].categoryLabel, "Авіоніка та двигунобудування");
  assert(!Object.hasOwn(previews[0], "readingTime"));
});
check("reduce: підсумок навчального набору", () => assert.deepEqual(service.summarizeArticles(frozen), {
  total: 8, published: 6, drafts: 2, totalReadingTime: 118,
  byCategory: { civil: 2, military: 2, drones: 2, technologies: 2 }, averageReadingTime: 14.75
}));
check("reduce: порожній масив і відсутність ділення на нуль", () => assert.deepEqual(service.summarizeArticles([]), {
  total: 0, published: 0, drafts: 0, totalReadingTime: 0,
  byCategory: { civil: 0, military: 0, drones: 0, technologies: 0 }, averageReadingTime: 0
}));
check("some і every обробляють стани та порожній набір", () => {
  assert.equal(service.hasDrafts(frozen), true);
  assert.equal(service.everyArticlePublished(frozen), false);
  assert.equal(service.hasDrafts([]), false);
  assert.equal(service.everyArticlePublished([]), true);
});
check("Сортування українських назв: Г, Ґ, Е, Є", () => {
  const titles = ["Європа", "Ґвинт", "Гелікоптер", "Екіпаж", "Аеропорт"];
  const data = titles.map((title, i) => service.createArticle({ ...payload, title }, i + 1));
  assert.deepEqual(service.sortArticlesByTitle(data).map(({ title }) => title), ["Аеропорт", "Гелікоптер", "Ґвинт", "Екіпаж", "Європа"]);
  assert.deepEqual(data.map(({ title }) => title), titles);
});
check("Сортування часу в обох напрямах без мутації", () => {
  assert.deepEqual(service.sortArticlesByReadingTime(frozen).map(({ readingTime }) => readingTime), [1, 5, 7, 8, 10, 12, 15, 60]);
  assert.equal(service.sortArticlesByReadingTime(frozen, "desc")[0].readingTime, 60);
  assert.equal(service.sortArticlesByTitle(frozen, "desc").length, 8);
});
check("Порожні find/filter/map/sort", () => {
  assert.equal(service.findArticleById([], 1), undefined);
  assert.deepEqual(service.filterArticles([]), []);
  assert.deepEqual(service.getArticlePreviews([]), []);
  assert.deepEqual(service.sortArticlesByTitle([]), []);
  assert.deepEqual(service.sortArticlesByReadingTime([]), []);
});
check("Сортування відхиляє невідомий напрям", () => assert.throws(() => service.sortArticlesByTitle(frozen, "up"), RangeError));
check("add повертає новий масив і копію нового запису", () => {
  const newArticle = service.createArticle(payload, 9);
  const result = service.addArticle(frozen, newArticle);
  assert.equal(result.length, 9); assert.notEqual(result, frozen); assert.notEqual(result[8], newArticle);
  assert.equal(frozen.length, 8);
});
check("add відхиляє дублікат id", () => assert.throws(() => service.addArticle(frozen, frozen[0]), RangeError));
check("update створює новий об’єкт, зберігає id та false", () => {
  const result = service.updateArticle(frozen, 1, { isPublished: false, title: "  Змінена   назва " });
  assert.notEqual(result, frozen); assert.notEqual(result[0], frozen[0]);
  assert.equal(result[0].id, 1); assert.equal(result[0].isPublished, false); assert.equal(result[0].title, "Змінена назва");
  assert.equal(frozen[0].isPublished, true); assert.equal(result[1], frozen[1]);
});
check("id не можна змінити навіть на той самий id", () => assert.throws(() => service.updateArticle(frozen, 1, { id: 1 }), TypeError));
check("update відхиляє невідоме поле та некоректний payload", () => {
  assert.throws(() => service.updateArticle(frozen, 1, { readingTime: 61 }), service.ArticleValidationError);
  assert.throws(() => service.updateArticle(frozen, 1, { unknown: true }), TypeError);
  assert.throws(() => service.updateArticle(frozen, 1, null), TypeError);
});
check("update без змін повертає новий масив із тим самим змістом", () => {
  const result = service.updateArticle(frozen, 1, {}); assert.notEqual(result, frozen); assert.deepEqual(result, frozen);
});
check("Відсутній target у update/remove — RangeError", () => {
  assert.throws(() => service.updateArticle(frozen, 99, { isPublished: true }), RangeError);
  assert.throws(() => service.removeArticle(frozen, 99), RangeError);
});
check("remove видаляє запис без зміни джерела", () => {
  const result = service.removeArticle(frozen, 1);
  assert.equal(result.length, 7); assert.notEqual(result, frozen); assert.equal(result[0].id, 2); assert.equal(frozen[0].id, 1);
});
check("Функції відхиляють некоректний dataset та повторні id", () => {
  assert.throws(() => service.filterArticles(null), TypeError);
  assert.throws(() => service.summarizeArticles([{}]), TypeError);
  assert.throws(() => service.findArticleById([frozen[0], frozen[0]], 1), RangeError);
});
check("Незмінність джерела після пошуку, сортування й CRUD", () => assert.equal(JSON.stringify(frozen), snapshot));

console.log(`\nSelf-checks: ${passed}/${passed} PASS. Помилок немає.`);
await import("./demo.js");
