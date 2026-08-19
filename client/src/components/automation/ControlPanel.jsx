import { PlayIcon, StopIcon, SpinnerIcon } from "../icons.jsx";

export default function ControlPanel({ status, onStart, onStop, busy }) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h3 className="font-semibold mb-1">Automation control</h3>
          <div className="text-[13px] text-muted flex items-center gap-2 min-h-[1.5rem]">
            {status.running ? (
              <>
                <span className="text-warn animate-spin">
                  <SpinnerIcon width={14} height={14} />
                </span>
                <span>
                  Running — sent <strong>{status.sentThisRun}</strong> this run
                  {status.currentEmail && (
                    <>
                      , now sending to <code className="text-[12px]">{status.currentEmail}</code>
                    </>
                  )}
                </span>
              </>
            ) : (
              <span>Idle. Press Start to begin sending to pending recipients.</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {status.running ? (
            <button className="apply-btn-ghost text-error" disabled={busy} onClick={onStop}>
              <StopIcon width={16} height={16} />
              Stop
            </button>
          ) : (
            <button className="apply-btn" disabled={busy} onClick={onStart}>
              <PlayIcon width={16} height={16} />
              Start automation
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
