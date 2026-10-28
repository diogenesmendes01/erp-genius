import { EstadoVazio } from "@/components/EstadoVazio";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { MetricasAtendimento } from "@/server/relatorios/atendimento";
import { fmtInteiro, fmtMinutos, variacaoTexto } from "./formato";
import { Kpi } from "./Kpi";

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const HORA_INICIAL = 7;

export function AbaConversas({ dados, anterior, mostrarAria }: { dados: MetricasAtendimento; anterior: MetricasAtendimento; mostrarAria: boolean }) {
  const maximo = Math.max(0, ...dados.calor.flat());
  return (
    <div className="space-y-5">
      <section aria-label="Indicadores de conversas" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Kpi rotulo="Conversas" valor={fmtInteiro(dados.conversas)} variacao={variacaoTexto(dados.conversas, anterior.conversas)} anterior={fmtInteiro(anterior.conversas)} />
        <Kpi rotulo="Primeira resposta" valor={fmtMinutos(dados.primeiraRespostaMediaMin)} variacao={variacaoTexto(dados.primeiraRespostaMediaMin, anterior.primeiraRespostaMediaMin)} anterior={fmtMinutos(anterior.primeiraRespostaMediaMin)} />
        <Kpi
          rotulo="Prazo estourado"
          valor={fmtInteiro(dados.prazoEstourado)}
          variacao={variacaoTexto(dados.prazoEstourado, anterior.prazoEstourado)}
          anterior={fmtInteiro(anterior.prazoEstourado)}
          complemento={dados.foraDoHorarioPct == null ? "Fora do horário: sem horário de funcionamento configurado." : undefined}
        />
      </section>
      <section aria-labelledby="conversas-volume" className="space-y-1 text-sm">
        <h2 id="conversas-volume" className="font-medium">Mensagens enviadas por dia</h2>
        {dados.volume.length === 0 ? (
          <EstadoVazio>Nenhuma mensagem enviada no período.</EstadoVazio>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border-soft">
            <Table className="min-w-[20rem]">
              <TableHeader>
                <TableRow className="text-left text-gray-600 hover:bg-transparent">
                  <TableHead scope="col" className="p-2">Dia</TableHead>
                  {mostrarAria ? (
                    <>
                      <TableHead scope="col" className="p-2">Aria</TableHead>
                      <TableHead scope="col" className="p-2">Equipe</TableHead>
                    </>
                  ) : (
                    <TableHead scope="col" className="p-2">Enviadas</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {dados.volume.map((v) => (
                  <TableRow key={v.dia}>
                    <TableHead scope="row" className="p-2 text-left font-normal">{v.dia.split("-").reverse().join("/")}</TableHead>
                    {mostrarAria ? (
                      <>
                        <TableCell className="p-2">{fmtInteiro(v.aria)}</TableCell>
                        <TableCell className="p-2">{fmtInteiro(v.equipe)}</TableCell>
                      </>
                    ) : (
                      <TableCell className="p-2">{fmtInteiro(v.equipe)}</TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
      <section aria-labelledby="conversas-pico" className="space-y-1 text-sm">
        <h2 id="conversas-pico" className="font-medium">Horários de pico</h2>
        <p className="text-xs text-gray-600">Mensagens recebidas por dia da semana e hora, no fuso da escola.</p>
        {maximo === 0 ? (
          <EstadoVazio>Nenhuma mensagem recebida no período.</EstadoVazio>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border-soft">
            <Table className="min-w-[40rem] text-center text-xs">
              <TableHeader>
                <TableRow className="text-gray-600 hover:bg-transparent">
                  <TableHead scope="col" className="p-1 text-left">Dia</TableHead>
                  {dados.calor[0].map((_, i) => <TableHead key={i} scope="col" className="p-1">{HORA_INICIAL + i}h</TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                {dados.calor.map((linha, d) => (
                  <TableRow key={d}>
                    <TableHead scope="row" className="p-1 text-left font-normal">{DIAS[d]}</TableHead>
                    {linha.map((n, i) => (
                      <TableCell key={i} className={"p-1 " + (n === 0 ? "text-gray-400" : n >= maximo * 0.75 ? "bg-brand-100 font-medium" : n >= maximo * 0.4 ? "bg-surface-muted" : "")}>{n === 0 ? "·" : fmtInteiro(n)}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}
