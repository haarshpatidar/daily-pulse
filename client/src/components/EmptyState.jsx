export default function EmptyState({ message, actionLabel, onAction }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <p className="text-[14px] text-muted">{message}</p>
      {actionLabel && onAction && (
        <button
          className="text-[13px] text-accent mt-2 hover:underline"
          onClick={onAction}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
