import { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabaseClient';
import { calculateDailyHours } from '../../utils/timeCalculator';
import type { Shift } from '../../utils/timeCalculator';
import { isLocalHoliday } from '../../utils/holidayHelper';

interface DayLog {
  id?: string;
  date: string;
  diaSemana: string;
  status: 'Trabalho' | 'Folga Fixa' | 'Folga Extra' | 'Feriado';
  turnos: Shift[];
  holidayName?: string | null;
}

interface HoursModuleProps {
  onBack: () => void;
}

type ViewMode = 'week' | 'month';

const formatarHora = (valor: string) => {
  const apenasDigitos = valor.replace(/\D/g, '').slice(0, 4);

  if (!apenasDigitos) return '';
  if (apenasDigitos.length <= 2) return apenasDigitos;

  const horas = apenasDigitos.slice(0, 2);
  const minutos = apenasDigitos.slice(2, 4);
  return `${horas}:${minutos}`;
};

const formatDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getWeekStart = (date: Date) => {
  const next = new Date(date);
  const day = next.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + diff);
  next.setHours(0, 0, 0, 0);
  return next;
};

const getWeekDays = (weekStart: Date) => {
  const dias = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  return dias.map((dia, index) => {
    const dataDia = new Date(weekStart);
    dataDia.setDate(weekStart.getDate() + index);
    const dateKey = formatDateKey(dataDia);
    const holidayCheck = isLocalHoliday(dateKey);
    const defaultStatus: DayLog['status'] = holidayCheck.ehFeriado
      ? 'Feriado'
      : dia === 'Saturday'
        ? 'Folga Fixa'
        : 'Trabalho';

    return {
      diaSemana: dia,
      date: dateKey,
      status: defaultStatus,
      turnos: [{ entrada: '', saida: '' }],
      holidayName: holidayCheck.ehFeriado ? holidayCheck.nome : null
    } satisfies DayLog;
  });
};

const getMonthLabel = (date: Date) => date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

export default function HoursModule({ onBack }: HoursModuleProps) {
  const [semana, setSemana] = useState<DayLog[]>(() => getWeekDays(getWeekStart(new Date())));
  const [loading, setLoading] = useState(true);
  const [copyingFrom, setCopyingFrom] = useState<string | null>(null);
  const [weekStartDate, setWeekStartDate] = useState<Date>(() => getWeekStart(new Date()));
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => new Date());

  const opcoesStatus = [
    { value: 'Trabalho', label: 'Work', icon: '💼' },
    { value: 'Folga Extra', label: 'Off', icon: '🌿' },
    { value: 'Feriado', label: 'Holiday', icon: '🎉' }
  ] as const;

  const getStatusButtonValue = (day: DayLog, statusValue: string) => {
    if (day.diaSemana === 'Saturday' && statusValue === 'Folga Fixa') {
      return 'Folga Fixa' as DayLog['status'];
    }
    if (day.diaSemana !== 'Saturday' && statusValue === 'Folga Fixa') {
      return 'Trabalho' as DayLog['status'];
    }
    return statusValue as DayLog['status'];
  };

  useEffect(() => {
    async function carregarHoras() {
      setLoading(true);
      const semanaBase = getWeekDays(weekStartDate);
      const datasDaSemana = semanaBase.map(d => d.date);

      const { data, error } = await supabase
        .from('work_logs')
        .select('*')
        .in('date', datasDaSemana);

      if (!error && data) {
        const registros = data as Array<{ id?: string; date: string; status?: DayLog['status']; shifts?: Shift[] }>;

        const semanaAtualizada = semanaBase.map(diaBase => {
          const registroBanco = registros.find(d => d.date === diaBase.date);
          if (registroBanco) {
            return {
              ...diaBase,
              id: registroBanco.id,
              status: registroBanco.status ?? diaBase.status,
              turnos: registroBanco.shifts ?? diaBase.turnos,
              holidayName: diaBase.holidayName
            };
          }
          return diaBase;
        });
        setSemana(semanaAtualizada);
      }
      setLoading(false);
    }
    carregarHoras();
  }, [weekStartDate]);

  // Função para salvar ou atualizar no banco de dados
  const salvarNoBanco = async (diaAtualizado: DayLog) => {
    const total_hours = diaAtualizado.status === 'Trabalho' ? calculateDailyHours(diaAtualizado.turnos) : 0;

    await supabase.from('work_logs').upsert({
      date: diaAtualizado.date,
      status: diaAtualizado.status,
      shifts: diaAtualizado.turnos,
      total_hours: total_hours
    }, { onConflict: 'date' });
  };

  const atualizarTurno = (date: string, turnoIndex: number, campo: 'entrada' | 'saida', valor: string) => {
    setSemana(prev => prev.map(day => {
      if (day.date === date) {
        const novosTurnos = [...day.turnos];
        novosTurnos[turnoIndex] = { ...novosTurnos[turnoIndex], [campo]: formatarHora(valor) };
        const diaAtualizado = { ...day, turnos: novosTurnos };
        salvarNoBanco(diaAtualizado);
        return diaAtualizado;
      }
      return day;
    }));
  };

  const adicionarTurno = (date: string) => {
    setSemana(prev => prev.map(day => {
      if (day.date === date && day.status === 'Trabalho') {
        const diaAtualizado = { ...day, turnos: [...day.turnos, { entrada: '', saida: '' }] };
        salvarNoBanco(diaAtualizado);
        return diaAtualizado;
      }
      return day;
    }));
  };

  const removerTurno = (date: string, turnoIndex: number) => {
    setSemana(prev => prev.map(day => {
      if (day.date === date && day.status === 'Trabalho') {
        const novosTurnos = day.turnos.filter((_, idx) => idx !== turnoIndex);
        const turnosFinal = novosTurnos.length > 0 ? novosTurnos : [{ entrada: '', saida: '' }];
        const diaAtualizado = { ...day, turnos: turnosFinal };
        salvarNoBanco(diaAtualizado);
        return diaAtualizado;
      }
      return day;
    }));
  };

  const mudarStatus = (date: string, novoStatus: DayLog['status']) => {
    setSemana(prev => prev.map(day => {
      if (day.date === date) {
        const diaAtualizado = { ...day, status: novoStatus, turnos: novoStatus === 'Trabalho' ? [{ entrada: '', saida: '' }] : [] };
        salvarNoBanco(diaAtualizado);
        return diaAtualizado;
      }
      return day;
    }));
  };

  const copiarHorarios = async (origemDate: string, destinoDate: string) => {
    const origem = semana.find(day => day.date === origemDate);
    const destino = semana.find(day => day.date === destinoDate);

    if (!origem || !destino) return;

    const diaAtualizado: DayLog = {
      ...destino,
      status: origem.status,
      turnos: origem.turnos.map(turno => ({ ...turno }))
    };

    setSemana(prev => prev.map(day => (day.date === destinoDate ? {
      ...day,
      status: diaAtualizado.status,
      turnos: diaAtualizado.turnos.map(turno => ({ ...turno }))
    } : day)));

    await salvarNoBanco(diaAtualizado);
    setCopyingFrom(null);
  };

  const totalSemanal = semana.reduce((acc, day) => {
    return acc + (day.status === 'Trabalho' ? calculateDailyHours(day.turnos) : 0);
  }, 0);

  const mudarSemana = (offset: number) => {
    const nextWeek = new Date(weekStartDate);
    nextWeek.setDate(nextWeek.getDate() + offset);
    setWeekStartDate(nextWeek);
    setCalendarMonth(nextWeek);
  };

  const abrirHoje = () => {
    const today = new Date();
    const nextWeek = getWeekStart(today);
    setWeekStartDate(nextWeek);
    setCalendarMonth(today);
    setViewMode('week');
  };

  const gerarDiasMes = () => {
    const primeiroDia = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
    const inicio = new Date(primeiroDia);
    const diaDaSemana = (primeiroDia.getDay() + 6) % 7;
    inicio.setDate(primeiroDia.getDate() - diaDaSemana);

    const dias: Date[] = [];
    const cursor = new Date(inicio);
    while (dias.length < 42) {
      dias.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }

    const weekDates = new Set(getWeekDays(weekStartDate).map(day => day.date));

    return dias.map(date => {
      const key = formatDateKey(date);
      const matchingDay = semana.find(day => day.date === key);
      const holidayCheck = isLocalHoliday(key);
      const dayStatus = matchingDay?.status ?? (holidayCheck.ehFeriado ? 'Feriado' : null);

      return {
        date,
        isCurrentMonth: date.getMonth() === calendarMonth.getMonth(),
        isSelected: key === formatDateKey(weekStartDate),
        isInSelectedWeek: weekDates.has(key),
        dayStatus
      };
    });
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading hours from the cloud...</div>;
  }

  return (
    <div>
      <header className="sticky top-0 z-10 bg-gradient-to-br from-indigo-600 via-indigo-500 to-violet-500 text-white px-4 pt-5 pb-4 shadow-lg rounded-b-[24px]">
        <button onClick={onBack} className="text-xs bg-white/15 backdrop-blur-sm px-3 py-1.5 rounded-full mb-3 border border-white/20">← Back</button>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-indigo-100">Weekly planner</p>
            <h1 className="text-xl font-bold tracking-tight">MyUSpaces Hours</h1>
          </div>
          <div className="rounded-2xl bg-white/15 px-3 py-2 text-right backdrop-blur-sm">
            <div className="text-[10px] uppercase tracking-[0.25em] text-indigo-100">Total</div>
            <div className="text-lg font-black">{totalSemanal.toFixed(2)}h</div>
          </div>
        </div>

        <div className="mt-4 rounded-2xl bg-white/15 p-3 backdrop-blur-sm border border-white/20">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-indigo-50">Weekly progress</span>
            <span className="font-semibold text-white">{Math.min(Math.round((totalSemanal / 45) * 100), 100)}%</span>
          </div>
          <div className="w-full bg-white/20 rounded-full h-2.5 mt-2 overflow-hidden">
            <div
              className={`h-2.5 rounded-full transition-all duration-500 ${totalSemanal > 46 ? 'bg-rose-300' : 'bg-emerald-300'}`}
              style={{ width: `${Math.min((totalSemanal / 45) * 100, 100)}%` }}
            ></div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white/15 p-3 backdrop-blur-sm border border-white/20">
          <div className="flex items-center gap-2">
            <button onClick={() => mudarSemana(-7)} className="rounded-full bg-white/15 px-3 py-1.5 text-sm font-semibold">←</button>
            <button onClick={() => mudarSemana(7)} className="rounded-full bg-white/15 px-3 py-1.5 text-sm font-semibold">→</button>
            <button onClick={abrirHoje} className="rounded-full bg-white/20 px-3 py-1.5 text-sm font-semibold">Today</button>
          </div>
          <div className="text-sm font-semibold text-white">
            {viewMode === 'week' ? `${weekStartDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${new Date(weekStartDate.getFullYear(), weekStartDate.getMonth(), weekStartDate.getDate() + 6).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : getMonthLabel(calendarMonth)}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setViewMode('week')} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${viewMode === 'week' ? 'bg-white text-indigo-600' : 'bg-white/15 text-white'}`}>Week</button>
            <button onClick={() => { setViewMode('month'); setCalendarMonth(weekStartDate); }} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${viewMode === 'month' ? 'bg-white text-indigo-600' : 'bg-white/15 text-white'}`}>Month</button>
          </div>
        </div>
      </header>

      <main className="p-4 space-y-4">
        {viewMode === 'month' && (
          <div className="rounded-[24px] border border-indigo-100 bg-gradient-to-br from-white via-indigo-50/70 to-violet-50 p-4 shadow-[0_16px_45px_-22px_rgba(79,70,229,0.4)]">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-gray-800">{getMonthLabel(calendarMonth)}</div>
                <div className="text-[11px] uppercase tracking-[0.25em] text-indigo-400">Selected week highlighted</div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))} className="rounded-full border border-indigo-100 bg-white/90 px-2.5 py-1 text-sm font-semibold text-indigo-600 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">←</button>
                <button onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))} className="rounded-full border border-indigo-100 bg-white/90 px-2.5 py-1 text-sm font-semibold text-indigo-600 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">→</button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-2 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-400">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(label => (
                <div key={label}>{label}</div>
              ))}
            </div>
            <div className="mt-2 grid grid-cols-7 gap-2">
              {gerarDiasMes().map(item => {
                const dayClasses = item.isSelected
                  ? 'border-indigo-500 bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/20'
                  : item.isInSelectedWeek
                    ? 'border-indigo-200 bg-indigo-50 text-indigo-700 shadow-sm'
                    : item.isCurrentMonth
                      ? 'border-gray-200 bg-white text-gray-700 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700'
                      : 'border-transparent bg-gray-50/80 text-gray-300 hover:bg-gray-100';

                const marker = item.dayStatus === 'Trabalho'
                  ? 'bg-emerald-500'
                  : item.dayStatus === 'Folga Fixa' || item.dayStatus === 'Folga Extra'
                    ? 'bg-amber-400'
                    : item.dayStatus === 'Feriado'
                      ? 'bg-rose-400'
                      : 'bg-transparent';

                return (
                  <button
                    key={formatDateKey(item.date)}
                    type="button"
                    onClick={() => {
                      setWeekStartDate(getWeekStart(item.date));
                      setCalendarMonth(item.date);
                      setViewMode('week');
                    }}
                    className={`group relative flex h-14 flex-col items-center justify-center rounded-2xl border text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${dayClasses}`}
                  >
                    <span>{item.date.getDate()}</span>
                    <span className={`mt-1 h-1.5 w-1.5 rounded-full ${marker}`} />
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex items-center justify-end gap-3 text-[11px] text-gray-500">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Work</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400" /> Off</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-400" /> Holiday</span>
            </div>
          </div>
        )}

        {viewMode === 'week' && (
          <div className="space-y-4">
            {semana.map(day => {
          const horasDiarias = day.status === 'Trabalho' ? calculateDailyHours(day.turnos) : 0;
          const isWorkDay = day.status === 'Trabalho';
          const cardStyle = isWorkDay
            ? 'border-indigo-200 bg-gradient-to-br from-white to-indigo-50'
            : 'border-amber-200 bg-gradient-to-br from-white to-amber-50';
          const badgeStyle = isWorkDay
            ? 'bg-indigo-100 text-indigo-700'
            : 'bg-amber-100 text-amber-700';
          const icon = isWorkDay ? '💼' : '🌿';
          
          return (
            <div key={day.date} className={`p-4 rounded-2xl shadow-sm border ${cardStyle}`}>
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className={`rounded-xl px-2.5 py-2 text-lg ${badgeStyle}`}>{icon}</div>
                  <div>
                    <span className="block text-base font-bold text-gray-800">{day.diaSemana}</span>
                    <span className="text-[10px] text-gray-400">{day.date}</span>
                    {day.holidayName && (
                      <span className="mt-1 inline-flex items-center rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                        🎉 {day.holidayName}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {opcoesStatus.map(status => {
                    const selected = day.status === status.value || (day.diaSemana === 'Saturday' && status.value === 'Folga Extra');
                    const isDisabled = false;
                    const resolvedValue = getStatusButtonValue(day, status.value);
                    return (
                      <button
                        key={status.value}
                        type="button"
                        onClick={() => mudarStatus(day.date, resolvedValue)}
                        className={`rounded-full px-2.5 py-1.5 text-[11px] font-semibold transition ${selected ? 'bg-indigo-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600'} ${isDisabled ? 'opacity-50' : ''}`}
                      >
                        {status.icon} {status.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {day.status === 'Trabalho' ? (
                <div className="space-y-2">
                  {day.turnos.map((turno, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <div className="flex-1">
                        <input 
                          type="text"
                          inputMode="numeric"
                          placeholder="HH:MM"
                          value={turno.entrada}
                          onChange={(e) => atualizarTurno(day.date, idx, 'entrada', e.target.value)}
                          className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 text-sm"
                        />
                      </div>
                      <div className="flex-1">
                        <input 
                          type="text"
                          inputMode="numeric"
                          placeholder="HH:MM"
                          value={turno.saida}
                          onChange={(e) => atualizarTurno(day.date, idx, 'saida', e.target.value)}
                          className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 text-sm"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removerTurno(day.date, idx)}
                        className="text-red-500 text-sm font-semibold px-2"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => adicionarTurno(day.date)}
                      className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-600"
                    >
                      + Add shift
                    </button>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setCopyingFrom(copyingFrom === day.date ? null : day.date)}
                        className="rounded-xl border border-indigo-200 bg-white px-3 py-2 text-sm font-semibold text-indigo-600 shadow-sm"
                      >
                        📋 Copy to...
                      </button>

                      {copyingFrom === day.date && (
                        <div className="absolute right-0 z-20 mt-2 w-44 rounded-2xl border border-gray-200 bg-white p-2 shadow-xl">
                          {semana
                            .filter(otherDay => otherDay.date !== day.date)
                            .map(otherDay => (
                              <button
                                key={otherDay.date}
                                type="button"
                                onClick={() => copiarHorarios(day.date, otherDay.date)}
                                className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm text-gray-700 transition hover:bg-indigo-50 hover:text-indigo-700"
                              >
                                <span>{otherDay.diaSemana}</span>
                                <span className="text-xs text-gray-400">{otherDay.date}</span>
                              </button>
                            ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-right text-xs text-gray-500 pt-1">
                    Subtotal: <span className={horasDiarias > 10 ? 'text-red-500 font-bold' : ''}>{horasDiarias.toFixed(2)}h</span>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3 text-center text-sm text-amber-700">
                  {day.status === 'Folga Fixa' ? '📅 Saturday fixed off' : day.status === 'Folga Extra' ? '🌿 Extra off' : '🎉 Holiday'}
                </div>
              )}
            </div>
          );
        })}
          </div>
        )}
      </main>
    </div>
  );
}