export interface Shift {
  entrada: string;
  saida: string;
}

// Converte "08:30" em minutos totais (510)
const timeToMinutes = (time: string): number => {
  if (!time) return 0;
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

// Calcula o total de horas de um dia baseado em múltiplos turnos
export const calculateDailyHours = (shifts: Shift[]): number => {
  let totalMinutes = 0;
  
  shifts.forEach(shift => {
    if (shift.entrada && shift.saida) {
      const start = timeToMinutes(shift.entrada);
      const end = timeToMinutes(shift.saida);
      if (end > start) {
        totalMinutes += (end - start);
      }
    }
  });

  return totalMinutes / 60; // Retorna em formato decimal (ex: 8.5)
};