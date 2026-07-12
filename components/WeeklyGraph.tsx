interface DayCompletion {
  label: string
  percent: number
  isToday: boolean
  isFuture: boolean
}

interface Props {
  days: DayCompletion[]
}

// Hand-rolled 7-bar chart — no charting library in this project yet, and 7
// bars showing a percentage doesn't need one.
export default function WeeklyGraph({ days }: Props) {
  return (
    <div className="bg-gray-900 rounded-xl p-6">
      <h2 className="text-lg font-semibold mb-6">This Week</h2>
      <div className="flex items-end justify-between gap-3 h-40">
        {days.map((day, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
            <span className="text-xs text-gray-400">{day.isFuture ? "" : `${day.percent}%`}</span>
            <div className="w-full bg-gray-800 rounded-t-md flex-1 flex items-end overflow-hidden">
              {!day.isFuture && (
                <div
                  className={`w-full rounded-t-md transition-all ${
                    day.isToday ? "bg-blue-500" : "bg-green-600"
                  }`}
                  style={{ height: `${Math.max(day.percent, day.percent > 0 ? 4 : 0)}%` }}
                />
              )}
            </div>
            <span className={`text-xs ${day.isToday ? "text-blue-400 font-semibold" : "text-gray-500"}`}>
              {day.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
