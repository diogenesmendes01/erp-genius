import { EstadoVazio } from "@/components/EstadoVazio";
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
            <table className="w-full min-w-[20rem] text-sm">
              <thead>
                <tr className="text-left text-gray-600">
                  <th scope="col" className="p-2">Dia</th>
                  {mostrarAria ? (
                    <>
                      <th scope="col" className="p-2">Aria</th>
                      <th scope="col" className="p-2">Equipe</th>
                    </>
                  ) : (
                    <th scope="col" className="p-2">Enviadas</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border-soft">
                {dados.volume.map((v) => (
                  <tr key={v.dia}>
                    <th scope="row" className="p-2 text-left font-normal">{v.dia.split("-").reverse().join("/")}</th>
                    {mostrarAria ? (
                      <>
                        <td className="p-2">{fmtInteiro(v.aria)}</td>
                        <td className="p-2">{fmtInteiro(v.equipe)}</td>
                      </>
                    ) : (
                      <td className="p-2">{fmtInteiro(v.equipe)}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
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
            <table className="w-full min-w-[40rem] text-center text-xs">
              <thead>
                <tr className="text-gray-600">
                  <th scope="col" className="p-1 text-left">Dia</th>
                  {dados.calor[0].map((_, i) => <th key={i} scope="col" className="p-1">{HORA_INICIAL + i}h</th>)}
                </tr>
              </thead>
              <tbody>
                {dados.calor.map((linha, d) => (
                  <tr key={d}>
                    <th scope="row" className="p-1 text-left font-normal">{DIAS[d]}</th>
                    {linha.map((n, i) => (
                      <td key={i} className={"p-1 " + (n === 0 ? "text-gray-400" : n >= maximo * 0.75 ? "bg-brand-100 font-medium" : n >= maximo * 0.4 ? "bg-surface-muted" : "")}>{n === 0 ? "·" : fmtInteiro(n)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
