import { useEffect, useState } from "react";
import { useNews } from "../store/useNews.js";
import { usePrefs, CATEGORIES } from "../store/usePrefs.js";
import { useUi } from "../store/useUi.js";
import { TIME_RANGES } from "../lib/time.js";
import FilterPills from "./FilterPills.jsx";
import NewsCard from "./NewsCard.jsx";
import EmptyState from "./EmptyState.jsx";
import Pagination from "./Pagination.jsx";
import { SkeletonNewsCard } from "./Skeleton.jsx";

const PAGE_SIZE = 12;

export default function NewsFeed({ limit, compact = false }) {
  const { articles, loading, error, category, timeRange, setCategory, setTimeRange, clearFilters, fetch } =
    useNews();
  const prefCategories = usePrefs((s) => s.categories);
  const setView = useUi((s) => s.setView);

  const [page, setPage] = useState(1);
  useEffect(() => {
    setPage(1);
  }, [category, timeRange]);

  const categoryOptions = [
    { id: "all", label: "All" },
    ...CATEGORIES.filter((c) => prefCategories.includes(c.id)),
  ];

  const totalPages = Math.max(1, Math.ceil(articles.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  const visible = compact
    ? articles.slice(0, limit)
    : articles.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <section className="mt-8 first:mt-0" aria-label="News">
      <div className="flex items-center justify-between mb-4">
        <h2 className="section-title">{compact ? "Latest news" : "News"}</h2>
        {compact ? (
          <button
            className="text-[13px] text-accent hover:underline"
            onClick={() => setView("news")}
          >
            View all
          </button>
        ) : (
          !loading &&
          articles.length > 0 && (
            <span className="text-[13px] text-muted">
              {articles.length} {articles.length === 1 ? "article" : "articles"}
            </span>
          )
        )}
      </div>

      {!compact && (
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <FilterPills
            label="Category"
            options={categoryOptions}
            value={category}
            onChange={setCategory}
          />
          <span className="hidden sm:block w-px h-6 bg-line" aria-hidden="true" />
          <FilterPills
            label="Time range"
            options={TIME_RANGES}
            value={timeRange}
            onChange={setTimeRange}
          />
        </div>
      )}

      {loading ? (
        <div className="news-grid">
          {Array.from({ length: compact ? 4 : 6 }, (_, i) => (
            <SkeletonNewsCard key={i} />
          ))}
        </div>
      ) : error ? (
        <EmptyState
          message="Couldn't load news — is the server running?"
          actionLabel="Retry"
          onAction={() => fetch()}
        />
      ) : visible.length === 0 ? (
        <EmptyState
          message="No articles match these filters."
          actionLabel="Clear filters"
          onAction={clearFilters}
        />
      ) : (
        <>
          <div className="news-grid">
            {visible.map((article, i) => (
              <NewsCard key={article.url} article={article} index={i} />
            ))}
          </div>
          {!compact && (
            <Pagination
              total={articles.length}
              page={safePage}
              pageSize={PAGE_SIZE}
              onChange={setPage}
            />
          )}
        </>
      )}
    </section>
  );
}
