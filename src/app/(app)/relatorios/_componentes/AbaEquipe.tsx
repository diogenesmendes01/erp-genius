import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EstadoVazio } from "@/components/EstadoVazio";
import type { DesempenhoUsuario } from "@/server/relatorios/equipe";
import { fmtInteiro, fmtMinutos, fmtMoedas, fmtPct, hrefRelatorio, variacaoTexto, type ParamsRelatorio } from "./formato";

export function AbaEquipe({ linhas, anterior, params }: { linhas: DesempenhoUsuario[]; anterior: DesempenhoUsuario[]; params: ParamsRelatorio }) {
  if (linhas.length === 0) return <EstadoVazio bloco>Nenhuma pessoa da equipe neste recorte.</EstadoVazio>;
  const antes = new Map(anterior.map((l) => [l.usuarioId, l]));
  return (
    <section aria-labelledby="equipe-titulo" className="space-y-1 text-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="equipe-titulo" className="font-medium">Desempenho por pessoa</h2>
        <Link href="/configuracao/crm/metas" className="text-brand-700 hover:underline max-sm:inline-flex max-sm:min-h-11 max-sm:items-center">Definir metas</Link>
      </div>
      <p className="text-xs text-gray-600">
        Meta dos meses do período: soma as metas e o realizado de cada mês inteiro que o período toca (um período de
        20/10 a 10/11 compara outubro e novembro completos). Valor ganho usa o valor previsto das oportunidades.
      </p>
      <div className="overflow-x-auto rounded-lg border border-border-soft">
        <Table className="min-w-[56rem]">
          <TableHeader>
            <TableRow className="text-left text-gray-600 hover:bg-transparent">
              <TableHead scope="col" className="p-2">Pessoa</TableHead>
              <TableHead scope="col" className="p-2">Oportunidades</TableHead>
              <TableHead scope="col" className="p-2">Ganhas</TableHead>
              <TableHead scope="col" className="p-2">Variação das ganhas</TableHead>
              <TableHead scope="col" className="p-2">Conversão</TableHead>
              <TableHead scope="col" className="p-2">Valor ganho</TableHead>
              <TableHead scope="col" className="p-2">Primeira resposta</TableHead>
              <TableHead scope="col" className="p-2">Tarefas concluídas</TableHead>
              <TableHead scope="col" className="p-2">Comissão</TableHead>
              <TableHead scope="col" className="p-2">Meta dos meses do período</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {linhas.map((l) => (
              <TableRow key={l.usuarioId}>
                <TableHead scope="row" className="p-2 text-left font-normal">
                  <Link href={hrefRelatorio(params, { detalhe: `responsavel:${l.usuarioId}`, busca: null })} className="text-brand-700 hover:underline max-sm:inline-flex max-sm:min-h-11 max-sm:items-center">{l.nome}</Link>
                </TableHead>
                <TableCell className="p-2">{fmtInteiro(l.oportunidades)}</TableCell>
                <TableCell className="p-2">{fmtInteiro(l.ganhas)}</TableCell>
                <TableCell className="p-2">{variacaoTexto(l.ganhas, antes.get(l.usuarioId)?.ganhas ?? null)}</TableCell>
                <TableCell className="p-2">{fmtPct(l.conversao)}</TableCell>
                <TableCell className="p-2">{fmtMoedas(l.valorGanho)}</TableCell>
                <TableCell className="p-2">{fmtMinutos(l.primeiraRespostaMediaMin)}</TableCell>
                <TableCell className="p-2">{fmtInteiro(l.tarefasConcluidas)}</TableCell>
                <TableCell className="p-2">{fmtMoedas(l.comissao)}</TableCell>
                <TableCell className="p-2">{l.meta.pct == null ? "Sem meta" : fmtPct(l.meta.pct)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
