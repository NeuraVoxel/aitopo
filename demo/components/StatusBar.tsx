export interface StatusBarProps {
  readonly status: string
}

/** Bottom status line, including Reserved: messages from the demo hook. */
export function StatusBar({ status }: StatusBarProps) {
  return (
    <div className="status-bar" role="status" aria-live="polite">
      {status}
    </div>
  )
}
