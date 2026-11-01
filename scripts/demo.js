import { articles } from "./data.js";
import { findArticleById, filterArticles, getArticlePreviews, summarizeArticles,
  sortArticlesByTitle, sortArticlesByReadingTime, hasDrafts, everyArticlePublished,
  createArticle, addArticle, updateArticle, removeArticle } from "./article-service.js";

console.log("\nAeroHub — демонстраційний звіт практичної №6");
console.table(getArticlePreviews(articles));
console.log("Підсумок:", summarizeArticles(articles));
console.log("Пошук id=2:", findArticleById(articles, 2)?.title);
console.log("Опубліковані БПЛА:", filterArticles(articles, { category: "drones", isPublished: true }).map(({ title }) => title));
console.log("Текстовий пошук АВІАЦІ:", filterArticles(articles, { query: "АВІАЦІ" }).map(({ id }) => id));
console.log("За українською назвою:", sortArticlesByTitle(articles).map(({ title }) => title));
console.log("Найдовше читання:", sortArticlesByReadingTime(articles, "desc")[0].readingTime, "хв");
console.log("Є чернетки:", hasDrafts(articles), "Усі опубліковані:", everyArticlePublished(articles));
const newArticle = createArticle({ title: "  Нова   публікація AeroHub ", category: " CIVIL ", readingTime: 3, isPublished: false }, 9);
const added = addArticle(articles, newArticle);
const updated = updateArticle(added, 9, { isPublished: true });
const removed = removeArticle(updated, 9);
console.log("CRUD: початковий → додавання → оновлення → видалення:", articles.length, added.length, updated.length, removed.length);
console.log("Початковий набір збережений:", JSON.stringify(articles) === JSON.stringify(removed));
