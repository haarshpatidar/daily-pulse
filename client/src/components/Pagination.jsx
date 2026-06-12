export default function Pagination({ total, page, pageSize, onChange }) {
  const pages = Math.ceil(total / pageSize);
  if (pages <= 1) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const go = (next) => {
    onChange(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="pagination">
      <span className="text-[13px] text-muted">
        Showing {from}–{to} of {total}
      </span>
      <div className="flex items-center gap-3">
        <button
          className="page-btn"
          onClick={() => go(page - 1)}
          disabled={page <= 1}
        >
          Previous
        </button>
        <span className="text-[13px] text-muted">
          Page {page} of {pages}
        </span>
        <button
          className="page-btn"
          onClick={() => go(page + 1)}
          disabled={page >= pages}
        >
          Next
        </button>
      </div>
    </div>
  );
}
