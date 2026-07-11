import Holidays from 'date-holidays';

const holidays = new Holidays('US', 'NJ');

export interface HolidayCheckResult {
  ehFeriado: boolean;
  nome: string | null;
}

export const isLocalHoliday = (dateString: string): HolidayCheckResult => {
  if (!dateString) {
    return { ehFeriado: false, nome: null };
  }

  const [year, month, day] = dateString.split('-').map(Number);

  if (!year || !month || !day) {
    return { ehFeriado: false, nome: null };
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  const holiday = holidays.isHoliday(date);

  if (!holiday || holiday.length === 0) {
    return { ehFeriado: false, nome: null };
  }

  const holidayName = holiday[0]?.name ?? null;

  return {
    ehFeriado: true,
    nome: holidayName ?? null
  };
};
