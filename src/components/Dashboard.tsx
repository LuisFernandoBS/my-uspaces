import { useMemo, useState } from 'react';
import HoursModule from '../modules/hours/HoursModule';
import TravelModule from '../modules/travel/TravelModule';

type ViewMode = 'home' | 'hours' | 'travel';

const formatDate = (date: Date) =>
  date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric'
  });

export default function Dashboard() {
  const [activeView, setActiveView] = useState<ViewMode>('home');

  const today = useMemo(() => new Date(), []);
  const greeting = useMemo(() => {
    const hour = today.getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }, [today]);

  const quickActions = [
    { label: 'Add Shift', icon: '⏰', action: () => setActiveView('hours') },
    { label: 'New Trip', icon: '✈️', action: () => setActiveView('travel') }
  ];

  if (activeView === 'hours') {
    return <HoursModule onBack={() => setActiveView('home')} />;
  }

  if (activeView === 'travel') {
    return <TravelModule onBack={() => setActiveView('home')} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 text-slate-800">
      <div className="mx-auto flex max-w-5xl flex-col gap-4">
        <header className="rounded-[28px] border border-gray-100/70 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-500">{formatDate(today)}</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{greeting}, Princesa!</h1>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-lg font-semibold text-white shadow-md">
              A
            </div>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2">
          <button
            type="button"
            onClick={() => setActiveView('hours')}
            className="rounded-[28px] border border-gray-100/70 bg-white p-6 text-left shadow-sm transition-all duration-200 active:scale-[0.98]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-indigo-600">Hours Module</p>
                <h2 className="mt-2 text-xl font-semibold text-slate-900">Work Day</h2>
                <p className="mt-2 text-sm text-slate-500">Today you are on track with your weekly hours.</p>
              </div>
              <div className="rounded-2xl bg-emerald-50 px-3 py-2 text-2xl">💼</div>
            </div>

            <div className="mt-6 rounded-2xl bg-slate-50 p-3">
              <div className="flex items-center justify-between text-sm text-slate-600">
                <span>Weekly total</span>
                <span className="font-semibold text-slate-900">39.5h</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-slate-200">
                <div className="h-2 w-[83%] rounded-full bg-emerald-500" />
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setActiveView('travel')}
            className="rounded-[28px] border border-gray-100/70 bg-white p-6 text-left shadow-sm transition-all duration-200 active:scale-[0.98]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-sky-600">Travel Module</p>
                <h2 className="mt-2 text-xl font-semibold text-slate-900">Next Trip: Miami Beach</h2>
                <p className="mt-2 text-sm text-slate-500">Your next adventure is just around the corner.</p>
              </div>
              <div className="rounded-2xl bg-sky-50 px-3 py-2 text-2xl">🌴</div>
            </div>

            <div className="mt-6 flex items-center justify-between rounded-2xl bg-slate-50 p-3 text-sm text-slate-600">
              <span>12 days left</span>
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">☀️ 24°C</span>
            </div>
          </button>
        </section>

        <section className="rounded-[28px] border border-gray-100/70 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900">Quick actions</h3>
            <span className="text-sm text-slate-500">Fast access</span>
          </div>

          <div className="flex gap-3 overflow-x-auto pb-1">
            {quickActions.map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={action.action}
                className="flex min-w-[110px] flex-col items-center gap-2 rounded-2xl border border-gray-100 bg-slate-50 px-3 py-3 text-sm font-medium text-slate-700 transition-all duration-200 active:scale-95"
              >
                <span className="text-xl">{action.icon}</span>
                {action.label}
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
