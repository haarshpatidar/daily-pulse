import { MailIcon, CheckIcon, AlertIcon, ClockIcon, SkipIcon, SendIcon } from "../icons.jsx";

const ITEMS = [
  { key: "total", label: "Total", Icon: MailIcon },
  { key: "sent", label: "Sent", Icon: CheckIcon, tone: "text-ok" },
  { key: "pending", label: "Pending", Icon: ClockIcon },
  { key: "sending", label: "In flight", Icon: SendIcon, tone: "text-warn" },
  { key: "failed", label: "Failed", Icon: AlertIcon, tone: "text-error" },
  { key: "skipped", label: "Skipped", Icon: SkipIcon },
];

export default function StatsCards({ stats }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {ITEMS.map(({ key, label, Icon, tone }) => (
        <div key={key} className="card p-4">
          <div className="flex items-center justify-between">
            <span className="source-label">{label}</span>
            <span className={tone || "text-muted"}>
              <Icon />
            </span>
          </div>
          <div className="mt-2 text-2xl font-semibold tabular-nums">{stats[key] ?? 0}</div>
        </div>
      ))}
    </div>
  );
}
