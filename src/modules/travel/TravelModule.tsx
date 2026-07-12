import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../../utils/supabaseClient';

interface Transporte {
  id: string;
  tipo: string;
  valor: number;
  detalhes: string;
}

interface ItemRoteiro {
  id: string;
  data: string;
  horario: string;
  local: string;
  descricao: string;
}

interface PackingItem {
  id: string;
  item: string;
  checado: boolean;
}

interface Viagem {
  id: string;
  destino: string;
  dataInicio: string;
  dataFim: string;
  valorHospedagem: number;
  transportesIda: Transporte[];
  transportesVolta: Transporte[];
  roteiro: ItemRoteiro[];
  packingList: PackingItem[];
}

interface WeatherForecast {
  icon: string;
  condition: string;
  temp: string;
  high: string;
  low: string;
}

type TransporteSentido = 'ida' | 'volta';

interface TravelModuleProps {
  onBack?: () => void;
}

const createDefaultPackingList = (): PackingItem[] => [
  { id: 'passaporte', item: 'Passaporte / DS-2019', checado: false },
  { id: 'carregadores', item: 'Carregadores', checado: false },
  { id: 'adaptador', item: 'Adaptador de tomada', checado: false },
  { id: 'medicamentos', item: 'Medicamentos essenciais', checado: false }
];

const formatDate = (dateValue: string) => {
  if (!dateValue) return '—';

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return dateValue;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

const mapViagemFromDb = (item: Record<string, unknown>): Viagem => ({
  id: String(item.id ?? ''),
  destino: String(item.destino ?? ''),
  dataInicio: String(item.data_inicio ?? ''),
  dataFim: String(item.data_fim ?? ''),
  valorHospedagem: Number(item.valor_hospedagem ?? 0),
  transportesIda: Array.isArray(item.transportes_ida) ? (item.transportes_ida as Transporte[]) : [],
  transportesVolta: Array.isArray(item.transportes_volta) ? (item.transportes_volta as Transporte[]) : [],
  roteiro: Array.isArray(item.roteiro) ? (item.roteiro as ItemRoteiro[]) : [],
  packingList: Array.isArray(item.packing_list) ? (item.packing_list as PackingItem[]) : []
});

const getWeatherFromCode = (code?: number) => {
  switch (code) {
    case 0:
      return { icon: '☀️', condition: 'Clear sky' };
    case 1:
    case 2:
      return { icon: '🌤️', condition: 'Partly cloudy' };
    case 3:
      return { icon: '☁️', condition: 'Overcast' };
    case 45:
    case 48:
      return { icon: '🌫️', condition: 'Fog' };
    case 51:
    case 53:
    case 55:
    case 61:
    case 63:
    case 65:
    case 80:
    case 81:
    case 82:
      return { icon: '🌧️', condition: 'Rain' };
    case 56:
    case 57:
    case 66:
    case 67:
      return { icon: '🌧️', condition: 'Freezing rain' };
    case 71:
    case 73:
    case 75:
    case 77:
    case 85:
    case 86:
      return { icon: '❄️', condition: 'Snow' };
    case 95:
    case 96:
    case 99:
      return { icon: '⛈️', condition: 'Thunderstorm' };
    default:
      return { icon: '🌤️', condition: 'Forecast' };
  }
};

const getWeatherPlaceholder = (): WeatherForecast => ({
  icon: '🌤️',
  condition: 'Weather unavailable',
  temp: '--',
  high: '--',
  low: '--'
});

const normalizeDateKey = (dateValue: string) => {
  const date = new Date(dateValue);
  return Number.isNaN(date.getTime()) ? dateValue : date.toISOString().split('T')[0];
};

export default function TravelModule({ onBack }: TravelModuleProps) {
  const [viagens, setViagens] = useState<Viagem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [newTripForm, setNewTripForm] = useState({ destino: '', dataInicio: '', dataFim: '' });
  const [newPackingItem, setNewPackingItem] = useState('');
  const [weatherByTripId, setWeatherByTripId] = useState<Record<string, Record<string, WeatherForecast>>>({});
  const [transporteForm, setTransporteForm] = useState({
    sentido: 'ida' as TransporteSentido,
    tipo: '',
    valor: '',
    detalhes: '',
    editingId: null as string | null
  });
  const [roteiroForm, setRoteiroForm] = useState({
    data: '',
    horario: '',
    local: '',
    descricao: '',
    editingId: null as string | null
  });

  const carregarViagens = async () => {
    setLoading(true);

    const { data, error } = await supabase.from('trips').select('*').order('data_inicio', { ascending: true });

    if (!error && data) {
      const viagensMapeadas = data.map((item) => mapViagemFromDb(item as Record<string, unknown>));
      setViagens(viagensMapeadas);
      if (viagensMapeadas.length > 0 && !selectedTripId) {
        setSelectedTripId(viagensMapeadas[0].id);
      }
    }

    setLoading(false);
  };

  useEffect(() => {
    void carregarViagens();
  }, []);

  useEffect(() => {
    if (!viagens.length) {
      setWeatherByTripId({});
      return;
    }

    if (!selectedTripId || !viagens.some((viagem) => viagem.id === selectedTripId)) {
      setSelectedTripId(viagens[0].id);
    }
  }, [selectedTripId, viagens]);

  useEffect(() => {
    if (!selectedTripId) return;

    const selectedTrip = viagens.find((viagem) => viagem.id === selectedTripId);
    if (!selectedTrip || !selectedTrip.destino?.trim()) {
      const key = normalizeDateKey(selectedTrip?.dataInicio ?? '');
      setWeatherByTripId((prev) => ({ ...prev, [selectedTripId]: { [key]: getWeatherPlaceholder() } }));
      return;
    }

    let active = true;

    const buscarClimaDiaria = async () => {
      const firstDayKey = normalizeDateKey(selectedTrip.dataInicio);
      setWeatherByTripId((prev) => ({
        ...prev,
        [selectedTripId]: { [firstDayKey]: { icon: '⏳', condition: 'Loading...', temp: '--', high: '--', low: '--' } }
      }));

      try {
        const geoResponse = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(selectedTrip.destino)}&count=1`
        );
        const geoData = await geoResponse.json();
        const city = geoData?.results?.[0];

        if (!city?.latitude || !city?.longitude) {
          throw new Error('Cidade não encontrada');
        }

        const forecastRes = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${city.latitude}&longitude=${city.longitude}&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=auto`
        );
        const forecast = await forecastRes.json();
        const times: string[] = forecast.daily?.time ?? [];
        const tempsMax: number[] = forecast.daily?.temperature_2m_max ?? [];
        const tempsMin: number[] = forecast.daily?.temperature_2m_min ?? [];
        const weathercodes: number[] = forecast.daily?.weathercode ?? [];

        const tripStart = new Date(selectedTrip.dataInicio);
        const tripEnd = new Date(selectedTrip.dataFim);
        const dayKeys: string[] = [];
        for (let d = new Date(tripStart); d <= tripEnd; d.setDate(d.getDate() + 1)) {
          dayKeys.push(new Date(d).toISOString().split('T')[0]);
        }

        const forecastsByDate: Record<string, WeatherForecast> = {};
        dayKeys.forEach((key) => {
          const index = times.indexOf(key);
          if (index >= 0) {
            const weatherData = getWeatherFromCode(weathercodes[index]);
            forecastsByDate[key] = {
              icon: weatherData.icon,
              condition: weatherData.condition,
              temp: `${Math.round(tempsMax[index] ?? 0)}°C`,
              high: `${Math.round(tempsMax[index] ?? 0)}°C`,
              low: `${Math.round(tempsMin[index] ?? 0)}°C`
            };
          } else {
            forecastsByDate[key] = getWeatherPlaceholder();
          }
        });

        if (!active) return;

        setWeatherByTripId((prev) => ({ ...prev, [selectedTripId]: forecastsByDate }));
      } catch {
        if (active) {
          const fallbackKey = normalizeDateKey(selectedTrip.dataInicio);
          setWeatherByTripId((prev) => ({ ...prev, [selectedTripId]: { [fallbackKey]: getWeatherPlaceholder() } }));
        }
      }
    };

    void buscarClimaDiaria();

    return () => {
      active = false;
    };
  }, [selectedTripId, viagens]);

  const salvarViagem = async (event: FormEvent) => {
    event.preventDefault();

    if (!newTripForm.destino.trim() || !newTripForm.dataInicio || !newTripForm.dataFim) return;

    const packingList = createDefaultPackingList();
    const payload = {
      destino: newTripForm.destino.trim(),
      data_inicio: newTripForm.dataInicio,
      data_fim: newTripForm.dataFim,
      valor_hospedagem: 0,
      transportes_ida: [],
      transportes_volta: [],
      roteiro: [],
      packing_list: packingList
    };

    const { data, error } = await supabase.from('trips').insert([payload]).select('*').single();

    if (error || !data) {
      console.error('Erro ao salvar viagem:', error);
      return;
    }

    const viagemCriada = mapViagemFromDb(data as Record<string, unknown>);
    setViagens((prev) => [viagemCriada, ...prev]);
    setSelectedTripId(viagemCriada.id);
    setNewTripForm({ destino: '', dataInicio: '', dataFim: '' });
    setShowForm(false);
  };

  const atualizarPackingList = async (viagemId: string, packingList: PackingItem[]) => {
    setViagens((prev) => prev.map((viagem) => (viagem.id === viagemId ? { ...viagem, packingList } : viagem)));

    await supabase.from('trips').update({ packing_list: packingList }).eq('id', viagemId);
  };

  const adicionarItemPacking = async (viagemId: string) => {
    const item = newPackingItem.trim();
    if (!item) return;

    const viagemAtual = viagens.find((viagem) => viagem.id === viagemId);
    if (!viagemAtual) return;

    const packingListAtualizada = [
      ...viagemAtual.packingList,
      { id: `${Date.now()}`, item, checado: false }
    ];

    await atualizarPackingList(viagemId, packingListAtualizada);
    setNewPackingItem('');
  };

  const alternarItemPacking = async (viagemId: string, itemId: string) => {
    const viagemAtual = viagens.find((viagem) => viagem.id === viagemId);
    if (!viagemAtual) return;

    const packingListAtualizada = viagemAtual.packingList.map((item) =>
      item.id === itemId ? { ...item, checado: !item.checado } : item
    );

    await atualizarPackingList(viagemId, packingListAtualizada);
  };

  const salvarTransporte = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedTripId) return;

    const viagemAtual = viagens.find((viagem) => viagem.id === selectedTripId);
    if (!viagemAtual) return;

    if (!transporteForm.tipo.trim() || !transporteForm.detalhes.trim()) return;

    const novoTransporte: Transporte = {
      id: transporteForm.editingId ?? `${Date.now()}`,
      tipo: transporteForm.tipo.trim(),
      valor: Number(transporteForm.valor) || 0,
      detalhes: transporteForm.detalhes.trim()
    };

    const listaAtual = transporteForm.sentido === 'ida' ? viagemAtual.transportesIda : viagemAtual.transportesVolta;
    const listaAtualizada = transporteForm.editingId
      ? listaAtual.map((item) => (item.id === transporteForm.editingId ? novoTransporte : item))
      : [...listaAtual, novoTransporte];

    const viagemAtualizada: Viagem = {
      ...viagemAtual,
      transportesIda: transporteForm.sentido === 'ida' ? listaAtualizada : viagemAtual.transportesIda,
      transportesVolta: transporteForm.sentido === 'volta' ? listaAtualizada : viagemAtual.transportesVolta
    };

    setViagens((prev) => prev.map((viagem) => (viagem.id === selectedTripId ? viagemAtualizada : viagem)));
    await supabase
      .from('trips')
      .update({
        transportes_ida: viagemAtualizada.transportesIda,
        transportes_volta: viagemAtualizada.transportesVolta
      })
      .eq('id', selectedTripId);

    setTransporteForm({ sentido: 'ida', tipo: '', valor: '', detalhes: '', editingId: null });
  };

  const editarTransporte = (sentido: TransporteSentido, transporte: Transporte) => {
    setTransporteForm({
      sentido,
      tipo: transporte.tipo,
      valor: String(transporte.valor),
      detalhes: transporte.detalhes,
      editingId: transporte.id
    });
  };

  const removerTransporte = async (sentido: TransporteSentido, transporteId: string) => {
    if (!selectedTripId) return;

    const viagemAtual = viagens.find((viagem) => viagem.id === selectedTripId);
    if (!viagemAtual) return;

    const listaAtual = sentido === 'ida' ? viagemAtual.transportesIda : viagemAtual.transportesVolta;
    const listaAtualizada = listaAtual.filter((item) => item.id !== transporteId);

    const viagemAtualizada: Viagem = {
      ...viagemAtual,
      transportesIda: sentido === 'ida' ? listaAtualizada : viagemAtual.transportesIda,
      transportesVolta: sentido === 'volta' ? listaAtualizada : viagemAtual.transportesVolta
    };

    setViagens((prev) => prev.map((viagem) => (viagem.id === selectedTripId ? viagemAtualizada : viagem)));
    await supabase
      .from('trips')
      .update({
        transportes_ida: viagemAtualizada.transportesIda,
        transportes_volta: viagemAtualizada.transportesVolta
      })
      .eq('id', selectedTripId);
  };

  const salvarRoteiro = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedTripId) return;

    const viagemAtual = viagens.find((viagem) => viagem.id === selectedTripId);
    if (!viagemAtual) return;

    if (!roteiroForm.local.trim() || !roteiroForm.descricao.trim()) return;

    const novoItem: ItemRoteiro = {
      id: roteiroForm.editingId ?? `${Date.now()}`,
      data: roteiroForm.data,
      horario: roteiroForm.horario,
      local: roteiroForm.local.trim(),
      descricao: roteiroForm.descricao.trim()
    };

    const roteiroAtualizado = roteiroForm.editingId
      ? viagemAtual.roteiro.map((item) => (item.id === roteiroForm.editingId ? novoItem : item))
      : [...viagemAtual.roteiro, novoItem];

    const viagemAtualizada: Viagem = {
      ...viagemAtual,
      roteiro: roteiroAtualizado
    };

    setViagens((prev) => prev.map((viagem) => (viagem.id === selectedTripId ? viagemAtualizada : viagem)));
    await supabase.from('trips').update({ roteiro: roteiroAtualizado }).eq('id', selectedTripId);
    setRoteiroForm({ data: '', horario: '', local: '', descricao: '', editingId: null });
  };

  const editarRoteiro = (item: ItemRoteiro) => {
    setRoteiroForm({
      data: item.data,
      horario: item.horario,
      local: item.local,
      descricao: item.descricao,
      editingId: item.id
    });
  };

  const removerRoteiro = async (itemId: string) => {
    if (!selectedTripId) return;

    const viagemAtual = viagens.find((viagem) => viagem.id === selectedTripId);
    if (!viagemAtual) return;

    const roteiroAtualizado = viagemAtual.roteiro.filter((item) => item.id !== itemId);
    const viagemAtualizada: Viagem = {
      ...viagemAtual,
      roteiro: roteiroAtualizado
    };

    setViagens((prev) => prev.map((viagem) => (viagem.id === selectedTripId ? viagemAtualizada : viagem)));
    await supabase.from('trips').update({ roteiro: roteiroAtualizado }).eq('id', selectedTripId);
  };

  const selectedTrip = viagens.find((viagem) => viagem.id === selectedTripId) ?? null;
  const weather = selectedTrip
    ? weatherByTripId[selectedTrip.id]?.[normalizeDateKey(selectedTrip.dataInicio)] ?? null
    : null;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#eef2ff_0%,_#f8fafc_60%,_#f1f5f9_100%)] p-4 text-slate-800">
      <div className="mx-auto flex max-w-6xl flex-col gap-4">
        <header className="rounded-[28px] border border-indigo-100 bg-gradient-to-br from-indigo-600 via-violet-600 to-sky-500 p-5 text-white shadow-[0_20px_55px_-20px_rgba(79,70,229,0.55)]">
          <button type="button" onClick={() => onBack?.()} className="text-xs bg-white/15 backdrop-blur-sm px-3 py-1.5 rounded-full mb-3 border border-white/20">← Back</button>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-indigo-100">Travel planner</p>
                <h1 className="mt-2 text-2xl font-black tracking-tight">My Trips</h1>
              </div>
            </div>

                <div className="mt-3 flex gap-2 overflow-x-auto">
                  {selectedTrip ? (() => {
                    const start = new Date(selectedTrip.dataInicio);
                    const end = new Date(selectedTrip.dataFim);
                    const dayKeys: string[] = [];
                    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                      dayKeys.push(new Date(d).toISOString().split('T')[0]);
                    }

                    return dayKeys.map((key) => {
                      const f = weatherByTripId[selectedTrip.id]?.[key] ?? getWeatherPlaceholder();
                      return (
                        <div key={key} className="flex min-w-[96px] flex-col items-center gap-1 rounded-lg bg-slate-50 px-3 py-2 text-center text-sm text-slate-700">
                          <div className="text-xl">{f.icon}</div>
                          <div className="font-medium">{formatDate(key)}</div>
                          <div className="text-xs">{f.temp}</div>
                        </div>
                      );
                    });
                  })() : null}
                </div>
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-indigo-700 shadow-lg shadow-indigo-950/10 transition hover:-translate-y-0.5"
            >
              + New Trip
            </button>
          </div>

          <div className="mt-4 rounded-2xl border border-white/20 bg-white/15 p-3 backdrop-blur-sm">
            <p className="text-sm text-indigo-50">Organize your exchange, Au Pair, or study abroad plans in one calm place.</p>
          </div>
        </header>

        {showForm && (
          <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">Add a new trip</h2>
                <p className="text-sm text-slate-500">Start with the essentials and expand later.</p>
              </div>
              <button type="button" onClick={() => setShowForm(false)} className="text-sm font-medium text-slate-500">
                Close
              </button>
            </div>

            <form onSubmit={salvarViagem} className="grid gap-3 md:grid-cols-3">
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                Destination
                <input
                  value={newTripForm.destino}
                  onChange={(event) => setNewTripForm((prev) => ({ ...prev, destino: event.target.value }))}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 outline-none ring-0 focus:border-indigo-400"
                  placeholder="Berlin"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                Start date
                <input
                  type="date"
                  value={newTripForm.dataInicio}
                  onChange={(event) => setNewTripForm((prev) => ({ ...prev, dataInicio: event.target.value }))}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 outline-none ring-0 focus:border-indigo-400"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                End date
                <input
                  type="date"
                  value={newTripForm.dataFim}
                  onChange={(event) => setNewTripForm((prev) => ({ ...prev, dataFim: event.target.value }))}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 outline-none ring-0 focus:border-indigo-400"
                />
              </label>
              <div className="md:col-span-3 flex justify-end">
                <button
                  type="submit"
                  className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
                >
                  Save trip
                </button>
              </div>
            </form>
          </section>
        )}

        <main className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800">Saved trips</h2>
              <span className="text-sm text-slate-500">{viagens.length} planned</span>
            </div>

            {loading ? (
              <div className="rounded-[24px] border border-slate-200 bg-white p-6 text-center text-sm text-slate-500 shadow-sm">
                Loading trips from the cloud...
              </div>
            ) : viagens.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-slate-300 bg-white/80 p-6 text-center text-sm text-slate-500 shadow-sm">
                No trips yet. Create your first one to start organizing.
              </div>
            ) : (
              viagens.map((viagem) => {
                const isSelected = selectedTrip?.id === viagem.id;

                return (
                  <button
                    key={viagem.id}
                    type="button"
                    onClick={() => setSelectedTripId(viagem.id)}
                    className={`w-full rounded-[24px] border p-4 text-left shadow-sm transition ${
                      isSelected
                        ? 'border-indigo-300 bg-gradient-to-br from-indigo-50 to-white shadow-indigo-100'
                        : 'border-slate-200 bg-white hover:border-indigo-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-base font-semibold text-slate-800">{viagem.destino}</h3>
                        <p className="mt-1 text-sm text-slate-500">{formatDate(viagem.dataInicio)} → {formatDate(viagem.dataFim)}</p>
                      </div>
                      <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700">
                        {viagem.valorHospedagem > 0 ? `$${viagem.valorHospedagem}` : 'Budget soon'}
                      </span>
                    </div>

                    <div className="mt-4 flex items-center justify-between rounded-2xl bg-slate-50 px-3 py-3 text-sm text-slate-600">
                      <span>🗓️ Itinerary</span>
                      <span className="font-medium text-slate-700">{viagem.roteiro.length} stops</span>
                    </div>

                    <div className="mt-3 flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Weather forecast</p>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="text-xl">{weatherByTripId[viagem.id]?.[normalizeDateKey(viagem.dataInicio)]?.icon ?? '🌤️'}</span>
                          <span className="font-semibold text-slate-700">
                            {weatherByTripId[viagem.id]?.[normalizeDateKey(viagem.dataInicio)]?.condition ?? 'Checking weather...'}
                          </span>
                        </div>
                      </div>
                      <div className="text-right text-sm font-semibold text-slate-700">
                        <div>{weatherByTripId[viagem.id]?.[normalizeDateKey(viagem.dataInicio)]?.temp ?? '--'}</div>
                        <div className="text-xs font-medium text-slate-500">
                          H {weatherByTripId[viagem.id]?.[normalizeDateKey(viagem.dataInicio)]?.high ?? '--'} · L {weatherByTripId[viagem.id]?.[normalizeDateKey(viagem.dataInicio)]?.low ?? '--'}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </section>

          <aside className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
            {selectedTrip ? (
              <div className="space-y-4">
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-indigo-500">Trip details</p>
                      <h2 className="mt-1 text-xl font-semibold text-slate-800">{selectedTrip.destino}</h2>
                    </div>
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                      {formatDate(selectedTrip.dataInicio)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-500">
                    {formatDate(selectedTrip.dataInicio)} → {formatDate(selectedTrip.dataFim)}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Weather forecast</p>
                      <p className="mt-1 text-sm font-semibold text-slate-700">{weather?.condition ?? 'Checking weather...'}</p>
                    </div>
                    <div className="text-3xl">{weather?.icon ?? '🌤️'}</div>
                  </div>
                  <div className="mt-3 flex items-end justify-between text-sm text-slate-600">
                    <span className="text-lg font-semibold text-slate-800">{weather?.temp ?? '--'}</span>
                    <span>H {weather?.high ?? '--'} · L {weather?.low ?? '--'}</span>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-800">Transport</h3>
                    <span className="text-xs text-slate-400">Outbound / return</span>
                  </div>

                  <form onSubmit={salvarTransporte} className="space-y-2 rounded-2xl bg-slate-50 p-3">
                    <div className="flex gap-2">
                      <select
                        value={transporteForm.sentido}
                        onChange={(event) => setTransporteForm((prev) => ({ ...prev, sentido: event.target.value as TransporteSentido }))}
                        className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
                      >
                        <option value="ida">Outbound</option>
                        <option value="volta">Return</option>
                      </select>
                      <input
                        value={transporteForm.tipo}
                        onChange={(event) => setTransporteForm((prev) => ({ ...prev, tipo: event.target.value }))}
                        placeholder="Flight / Bus"
                        className="flex-1 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
                      />
                    </div>
                    <input
                      type="number"
                      value={transporteForm.valor}
                      onChange={(event) => setTransporteForm((prev) => ({ ...prev, valor: event.target.value }))}
                      placeholder="Value"
                      className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    />
                    <textarea
                      value={transporteForm.detalhes}
                      onChange={(event) => setTransporteForm((prev) => ({ ...prev, detalhes: event.target.value }))}
                      placeholder="Details"
                      className="min-h-[70px] w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    />
                    <button type="submit" className="rounded-full bg-indigo-600 px-3 py-2 text-sm font-semibold text-white">
                      {transporteForm.editingId ? 'Save changes' : 'Add transport'}
                    </button>
                  </form>

                  <div className="mt-3 space-y-2">
                    {[{ label: 'Outbound', items: selectedTrip.transportesIda }, { label: 'Return', items: selectedTrip.transportesVolta }].map((group) => (
                      <div key={group.label} className="rounded-2xl bg-slate-50 p-2">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{group.label}</p>
                        {group.items.length === 0 ? (
                          <p className="text-sm text-slate-500">No transport entries yet.</p>
                        ) : (
                          group.items.map((item) => (
                            <div key={item.id} className="mb-2 rounded-2xl border border-slate-200 bg-white p-2 text-sm">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p className="font-semibold text-slate-700">{item.tipo}</p>
                                  <p className="text-xs text-slate-500">{item.detalhes}</p>
                                </div>
                                <div className="text-right text-xs font-semibold text-slate-600">
                                  <div>${item.valor}</div>
                                  <div className="mt-1 flex gap-2">
                                    <button type="button" onClick={() => editarTransporte(group.label === 'Outbound' ? 'ida' : 'volta', item)} className="text-indigo-600">
                                      Edit
                                    </button>
                                    <button type="button" onClick={() => void removerTransporte(group.label === 'Outbound' ? 'ida' : 'volta', item.id)} className="text-rose-600">
                                      Remove
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-800">Itinerary</h3>
                    <span className="text-xs text-slate-400">Plan your days</span>
                  </div>

                  <form onSubmit={salvarRoteiro} className="space-y-2 rounded-2xl bg-slate-50 p-3">
                    <input
                      value={roteiroForm.data}
                      onChange={(event) => setRoteiroForm((prev) => ({ ...prev, data: event.target.value }))}
                      type="date"
                      className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    />
                    <input
                      value={roteiroForm.horario}
                      onChange={(event) => setRoteiroForm((prev) => ({ ...prev, horario: event.target.value }))}
                      placeholder="Time"
                      className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    />
                    <input
                      value={roteiroForm.local}
                      onChange={(event) => setRoteiroForm((prev) => ({ ...prev, local: event.target.value }))}
                      placeholder="Place"
                      className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    />
                    <textarea
                      value={roteiroForm.descricao}
                      onChange={(event) => setRoteiroForm((prev) => ({ ...prev, descricao: event.target.value }))}
                      placeholder="Description"
                      className="min-h-[70px] w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    />
                    <button type="submit" className="rounded-full bg-indigo-600 px-3 py-2 text-sm font-semibold text-white">
                      {roteiroForm.editingId ? 'Save changes' : 'Add item'}
                    </button>
                  </form>

                  <div className="mt-3 space-y-2">
                    {selectedTrip.roteiro.length === 0 ? (
                      <p className="text-sm text-slate-500">No itinerary items yet.</p>
                    ) : (
                      selectedTrip.roteiro.map((item) => (
                        <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-2 text-sm">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-semibold text-slate-700">{item.local}</p>
                              <p className="text-xs text-slate-500">{item.data} · {item.horario}</p>
                              <p className="mt-1 text-xs text-slate-600">{item.descricao}</p>
                            </div>
                            <div className="flex gap-2 text-xs text-indigo-600">
                              <button type="button" onClick={() => editarRoteiro(item)}>
                                Edit
                              </button>
                              <button type="button" onClick={() => void removerRoteiro(item.id)} className="text-rose-600">
                                Remove
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-800">Packing List</h3>
                    <span className="text-xs text-slate-400">Saved live</span>
                  </div>

                  <div className="space-y-2">
                    {selectedTrip.packingList.map((item) => (
                      <label key={item.id} className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={item.checado}
                          onChange={() => void alternarItemPacking(selectedTrip.id, item.id)}
                          className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className={item.checado ? 'line-through text-slate-400' : ''}>{item.item}</span>
                      </label>
                    ))}
                  </div>

                  <div className="mt-3 flex gap-2">
                    <input
                      value={newPackingItem}
                      onChange={(event) => setNewPackingItem(event.target.value)}
                      placeholder="Add an item"
                      className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-indigo-400"
                    />
                    <button
                      type="button"
                      onClick={() => void adicionarItemPacking(selectedTrip.id)}
                      className="rounded-full bg-indigo-600 px-3 py-2 text-sm font-semibold text-white"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                Select a trip to see its details.
              </div>
            )}
          </aside>
        </main>
      </div>
    </div>
  );
}
