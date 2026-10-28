/** Horas úteis (seg–sex, 9h–18h, horário de Brasília, UTC−3 sem horário de verão) entre duas datas. */
export function horasUteis(de: Date, ate: Date): number {
  const fuso = 3 * 3600e3;
  const ini = de.getTime() - fuso; // relógio de Brasília expresso em UTC
  const fim = ate.getTime() - fuso;
  if (fim <= ini) return 0;
  let ms = 0;
  const dia = new Date(ini); dia.setUTCHours(0, 0, 0, 0);
  for (let d = dia.getTime(); d < fim; d += 864e5) {
    const semana = new Date(d).getUTCDay();
    if (semana === 0 || semana === 6) continue;
    const a = Math.max(ini, d + 9 * 3600e3);
    const b = Math.min(fim, d + 18 * 3600e3);
    if (b > a) ms += b - a;
  }
  return ms / 3600e3;
}
