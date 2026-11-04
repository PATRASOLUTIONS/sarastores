'use client'

import toast from 'react-hot-toast'
import { BANNER_WEEKDAYS, deadlineIndiaInput, deadlineFromIndiaInput, type ScheduledBanner } from '@/lib/banner-schedule'

type Schedule = Pick<ScheduledBanner, 'startsAt' | 'expiresAt' | 'weekdays'>
const input = 'mt-1 h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary'

export default function BannerScheduleEditor({ schedule, onChange }: { schedule: Schedule; onChange: (value: Schedule) => void }) {
  const setTime = (key: 'startsAt' | 'expiresAt', value: string) => {
    try { onChange({ [key]: value ? deadlineFromIndiaInput(value) : '' }) }
    catch { toast.error('Enter a valid visibility date and time.') }
  }
  return <fieldset className="space-y-4 rounded-xl border border-gray-200 bg-gray-50 p-3">
    <legend className="px-1 text-sm font-bold text-gray-900">Visibility schedule</legend>
    <div>
      <div className="flex items-center justify-between gap-2"><p className="text-sm font-semibold text-gray-800">Show on these weekdays</p><button type="button" onClick={() => onChange({ weekdays: null })} className="text-xs font-semibold text-blue-700 underline">Every day</button></div>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">{BANNER_WEEKDAYS.map((day, value) => <label key={day} className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={!schedule.weekdays || schedule.weekdays.includes(value)} onChange={event => {
          const selected = schedule.weekdays || BANNER_WEEKDAYS.map((_, index) => index)
          const next = event.target.checked ? [...selected.filter(day => day !== value), value].sort((a, b) => a - b) : selected.filter(day => day !== value)
          onChange({ weekdays: next.length === 7 ? null : next })
        }} className="h-4 w-4 accent-blue-700" />{day}
      </label>)}</div>
      {schedule.weekdays?.length === 0 && <p role="alert" className="mt-2 text-xs text-red-700">Select at least one weekday or choose Every day.</p>}
    </div>
    <div>
      <label className="block text-xs font-semibold text-gray-600">Visible from<select className={input} value={schedule.startsAt == null ? 'now' : 'date'} onChange={event => onChange({ startsAt: event.target.value === 'now' ? null : '' })}><option value="now">Start immediately</option><option value="date">Set start date and time</option></select></label>
      {schedule.startsAt != null && <label className="mt-2 block text-xs font-semibold text-gray-600">Start — India Standard Time (IST)<input id="banner-startsAt" type="datetime-local" className={input} value={deadlineIndiaInput(schedule.startsAt)} onChange={event => setTime('startsAt', event.target.value)} /></label>}
    </div>
    <div>
      <label className="block text-xs font-semibold text-gray-600">Visible until<select className={input} value={schedule.expiresAt == null ? 'never' : 'date'} onChange={event => onChange({ expiresAt: event.target.value === 'never' ? null : '' })}><option value="never">Never end</option><option value="date">Set end date and time</option></select></label>
      {schedule.expiresAt != null && <label className="mt-2 block text-xs font-semibold text-gray-600">End / deadline — India Standard Time (IST)<input id="banner-expiresAt" type="datetime-local" className={input} min={deadlineIndiaInput(schedule.startsAt)} value={deadlineIndiaInput(schedule.expiresAt)} onChange={event => setTime('expiresAt', event.target.value)} /></label>}
    </div>
    <p className="text-xs leading-5 text-gray-600">Weekdays and the date range apply together in IST. The poster starts at the selected time, shows only on checked days, and hides at the end time. The On/Off switch also controls visibility.</p>
    {schedule.expiresAt && Date.parse(schedule.expiresAt) <= Date.now() && <p className="text-xs font-semibold text-red-700">The end date has passed. Change it or choose Never end to show this poster again.</p>}
  </fieldset>
}
