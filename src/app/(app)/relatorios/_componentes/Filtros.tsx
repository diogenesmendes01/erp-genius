import Link from "next/link";
import { botaoClasses } from "@/components/Botao";
import { ORIGEM_CANAL_LABEL, TEMPERATURA_LABEL } from "@/lib/labels";

const CAMPO = "min-h-11 rounded-md border border-gray-300 px-2 text-sm md:min-h-0 md:py-1.5";

export const PERIODOS = [
  { valor: "HOJE", rotulo: "Hoje" },
  { valor: "7D", rotulo: "Últimos 7 dias" },
  { valor: "30D", rotulo: "Últimos 30 dias" },
  { valor: "PERSONALIZADO", rotulo: "Personalizado" },
] as const;

export function Filtros({ valores, aba, pessoas, mostrarResponsavel, mostrarAutor, mostrarFunil, exportarHref }: {
  valores: Record<string, string>;
  aba: string;
  pessoas: { id: string; nome: string }[];
  /** Vendedor não filtra por responsável: só enxerga os próprios números. */
  mostrarResponsavel: boolean;
  /** Separar Aria × equipe só faz sentido para quem vê a Aria. */
  mostrarAutor: boolean;
  /** Filtro de funil: só existe se a Fase 2 criou funis; hoje fica oculto. */
  mostrarFunil: boolean;
  /** Só com a capacidade de exportar; null esconde o botão. */
  exportarHref: string | null;
}) {
  const filtrando = ["periodo", "de", "ate", "responsavel", "origem", "temperatura", "autor"].some((k) => valores[k]);
  return (
    <form method="get" action="/relatorios" role="search" aria-label="Filtrar relatórios" className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="aba" value={aba} />
      <select name="periodo" defaultValue={valores.periodo || "30D"} aria-label="Período" className={CAMPO}>
        {PERIODOS.map((p) => <option key={p.valor} value={p.valor}>{p.rotulo}</option>)}
      </select>
      <label className="text-xs text-gray-600">
        De <input type="date" name="de" defaultValue={valores.de ?? ""} className={CAMPO} />
      </label>
      <label className="text-xs text-gray-600">
        Até <input type="date" name="ate" defaultValue={valores.ate ?? ""} className={CAMPO} />
      </label>
      {mostrarResponsavel && (
        <select name="responsavel" defaultValue={valores.responsavel ?? ""} aria-label="Responsável" className={CAMPO}>
          <option value="">Todos os responsáveis</option>
          {pessoas.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
        </select>
      )}
      {mostrarFunil && (
        <select name="funil" defaultValue={valores.funil ?? ""} aria-label="Funil" className={CAMPO}>
          <option value="">Todos os funis</option>
        </select>
      )}
      <select name="origem" defaultValue={valores.origem ?? ""} aria-label="Origem" className={CAMPO}>
        <option value="">Todas as origens</option>
        {Object.entries(ORIGEM_CANAL_LABEL).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
      </select>
      <select name="temperatura" defaultValue={valores.temperatura ?? ""} aria-label="Temperatura" className={CAMPO}>
        <option value="">Todas as temperaturas</option>
        {Object.entries(TEMPERATURA_LABEL).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
      </select>
      {mostrarAutor && (
        <select name="autor" defaultValue={valores.autor ?? ""} aria-label="Quem fez" className={CAMPO}>
          <option value="">Aria e equipe</option>
          <option value="ARIA">Só a Aria</option>
          <option value="EQUIPE">Só a equipe</option>
        </select>
      )}
      <button type="submit" className={botaoClasses({ variante: "secundario" })}>Filtrar</button>
      {filtrando && <Link href={`/relatorios?aba=${aba}`} className="text-sm text-brand-700 hover:underline">Limpar filtros</Link>}
      {exportarHref && <a href={exportarHref} download className={botaoClasses({ variante: "secundario" })}>Exportar CSV</a>}
    </form>
  );
}
