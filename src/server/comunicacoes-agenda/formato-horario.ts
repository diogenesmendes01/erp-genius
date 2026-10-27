export function formatarIntervaloAvisoAgenda(inicio: Date, fim: Date, fuso: string) {
  const data = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: fuso });
  const completo = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: fuso });
  const hora = new Intl.DateTimeFormat("pt-BR", { timeStyle: "short", timeZone: fuso });
  const inicioTexto = completo.format(inicio), fimTexto = data.format(inicio) === data.format(fim) ? hora.format(fim) : completo.format(fim);
  return `${inicioTexto}–${fimTexto} (${fuso})`;
}
