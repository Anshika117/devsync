"use client"
import { useState } from "react"

interface Props {
  show: boolean
  count: number
}

// The entire "notification" system for this feature: a client-side popup
// that only renders if the server already decided (via
// shouldShowBufferReminder) that today is the user's buffer day AND the
// buffer list is non-empty. No push service, no email — just a boolean.
export default function BufferReminderPopup({ show, count }: Props) {
  const [dismissed, setDismissed] = useState(false)

  if (!show || dismissed || count === 0) return null

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-2xl w-full max-w-md p-6 border border-orange-700/50">
        <div className="text-3xl mb-3">🔥</div>
        <h2 className="text-lg font-bold text-white mb-2">Buffer day reminder</h2>
        <p className="text-gray-400 text-sm mb-6">
          You have {count} unfinished goal{count !== 1 ? "s" : ""} sitting in your buffer list.
          Today is your buffer day — good time to clear a few.
        </p>
        <button
          onClick={() => setDismissed(true)}
          className="w-full py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold transition cursor-pointer"
        >
          Got it
        </button>
      </div>
    </div>
  )
}
