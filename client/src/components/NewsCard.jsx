import { timeAgo } from "../lib/time.js";
import { ExternalLinkIcon } from "./icons.jsx";

export default function NewsCard({ article, index }) {
  return (
    <article
      className="card card-enter flex flex-col"
      style={{ "--stagger": Math.min(index, 12) }}
    >
      <span className="source-label mb-2">{article.source}</span>

      <a
        href={article.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex-1 text-[15px] font-medium leading-normal hover:text-accent transition-colors duration-150"
      >
        {article.title}
      </a>

      <div className="flex items-center justify-between mt-4">
        <span className="text-[13px] text-muted">{timeAgo(article.publishedAt)}</span>
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="icon-btn !w-8 !h-8"
          aria-label={`Open "${article.title}" in a new tab`}
        >
          <ExternalLinkIcon />
        </a>
      </div>
    </article>
  );
}
