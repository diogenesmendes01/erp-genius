import Link from "next/link";
import { botaoClasses } from "@/components/Botao";
import { CampoCombobox } from "@/components/ui/combobox";
import { CampoData } from "@/components/ui/date-picker";
import { CampoSelect } from "@/components/ui/select";
import { ORIGEM_CANAL_LABEL, TEMPERATURA_LABEL } from "@/lib/labels";

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
  mostrarResponsavel: boolean;
  mostrarAutor: boolean;
  mostrarFunil: boolean;
  exportarHref: string | null;
}) {
  const filtrando = ["periodo", "de", "ate", "responsavel", "origem", "temperatura", "autor"].some((k) => valores[k]);
  return (
    <form method="get" action="/relatorios" role="search" aria-label="Filtrar relatórios" className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="aba" value={aba} />
      <label htmlFor="relatorio-periodo" className="sr-only">Período</label>
      <CampoSelect id="relatorio-periodo" name="periodo" defaultValue={valores.periodo || "30D"} opcoes={PERIODOS.map((p) => ({ valor: p.valor, rotulo: p.rotulo }))} />
      <label className="grid gap-1 text-xs text-gray-600">
        De
        <CampoData name="de" defaultValue={valores.de ?? ""} />
      </label>
      <label className="grid gap-1 text-xs text-gray-600">
        Até
        <CampoData name="ate" defaultValue={valores.ate ?? ""} />
      </label>
      {mostrarResponsavel && (
        <CampoCombobox name="responsavel" defaultValue={valores.responsavel ?? ""} aria-label="Responsável" vazio="Todos os responsáveis" opcoes={pessoas.map((r) => ({ valor: r.id, rotulo: r.nome }))} />
      )}
      {mostrarFunil && (
        <CampoCombobox name="funil" defaultValue={valores.funil ?? ""} aria-label="Funil" vazio="Todos os funis" opcoes={[]} />
      )}
      <CampoCombobox name="origem" defaultValue={valores.origem ?? ""} aria-label="Origem" vazio="Todas as origens" opcoes={Object.entries(ORIGEM_CANAL_LABEL).map(([valor, rotulo]) => ({ valor, rotulo }))} />
      <CampoCombobox name="temperatura" defaultValue={valores.temperatura ?? ""} aria-label="Temperatura" vazio="Todas as temperaturas" opcoes={Object.entries(TEMPERATURA_LABEL).map(([valor, rotulo]) => ({ valor, rotulo }))} />
      {mostrarAutor && (
        <CampoCombobox
          name="autor"
          defaultValue={valores.autor ?? ""}
          aria-label="Quem fez"
          vazio="Aria e equipe"
          opcoes={[{ valor: "ARIA", rotulo: "Só a Aria" }, { valor: "EQUIPE", rotulo: "Só a equipe" }]}
        />
      )}
      <button type="submit" className={botaoClasses({ variante: "secundario" })}>Filtrar</button>
      {filtrando && <Link href={`/relatorios?aba=${aba}`} className="text-sm text-brand-700 hover:underline">Limpar filtros</Link>}
      {exportarHref && <a href={exportarHref} download className={botaoClasses({ variante: "secundario" })}>Exportar CSV</a>}
    </form>
  );
}
