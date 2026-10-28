import { EstadoVazio } from "@/components/EstadoVazio";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { MetricasAriaEquipe } from "@/server/relatorios/aria";
import { fmtInteiro, fmtMinutos, fmtPct, variacaoTexto } from "./formato";
import { Kpi } from "./Kpi";

export function AbaAria({ dados, anterior }: { dados: MetricasAriaEquipe; anterior: MetricasAriaEquipe }) {
  if (dados.aria.atendimentos === 0 && dados.equipe.atendimentos === 0) {
    return <EstadoVazio bloco>Nenhum atendimento comercial com resposta neste período e com estes filtros.</EstadoVazio>;
  }
  const linhas = [
    { rotulo: "Atendimentos", a: fmtInteiro(dados.aria.atendimentos), e: fmtInteiro(dados.equipe.atendimentos) },
    { rotulo: "Conversão em matrícula", a: fmtPct(dados.aria.conversao), e: fmtPct(dados.equipe.conversao) },
    { rotulo: "Primeira resposta média", a: fmtMinutos(dados.aria.primeiraRespostaMediaMin), e: fmtMinutos(dados.equipe.primeiraRespostaMediaMin) },
    { rotulo: "Perdidos sem resposta", a: fmtInteiro(dados.aria.perdidosSemResposta), e: fmtInteiro(dados.equipe.perdidosSemResposta) },
  ];
  return (
    <div className="space-y-5">
      <section aria-label="Indicadores da Aria" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Kpi rotulo="Taxa de handoff" valor={fmtPct(dados.taxaHandoff)} variacao={variacaoTexto(dados.taxaHandoff, anterior.taxaHandoff)} anterior={fmtPct(anterior.taxaHandoff)} />
        <Kpi rotulo="Sugestões aprovadas" valor={fmtPct(dados.sugestoesAprovadas)} variacao={variacaoTexto(dados.sugestoesAprovadas, anterior.sugestoesAprovadas)} anterior={fmtPct(anterior.sugestoesAprovadas)} />
        <Kpi rotulo="Etapas avançadas pela Aria" valor={fmtInteiro(dados.etapasAvancadasAria)} variacao={variacaoTexto(dados.etapasAvancadasAria, anterior.etapasAvancadasAria)} anterior={fmtInteiro(anterior.etapasAvancadasAria)} />
      </section>
      <section aria-labelledby="aria-comparacao" className="space-y-1 text-sm">
        <h2 id="aria-comparacao" className="font-medium">Aria e equipe neste período</h2>
        <p className="text-xs text-gray-600">Cada atendimento conta no lado de quem deu a primeira resposta.</p>
        <div className="overflow-x-auto rounded-lg border border-border-soft">
          <Table className="min-w-[28rem]">
            <TableHeader>
              <TableRow className="text-left text-gray-600 hover:bg-transparent">
                <TableHead scope="col" className="p-2">Indicador</TableHead>
                <TableHead scope="col" className="p-2">Aria</TableHead>
                <TableHead scope="col" className="p-2">Equipe</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.map((l) => (
                <TableRow key={l.rotulo}>
                  <TableHead scope="row" className="p-2 text-left font-normal">{l.rotulo}</TableHead>
                  <TableCell className="p-2">{l.a}</TableCell>
                  <TableCell className="p-2">{l.e}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
