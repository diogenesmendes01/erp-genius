import Link from "next/link";
import { Papel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarAdiantamentosAditivo } from "@/server/contratos/adiantamento-aditivo";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { formatarInstanteExibicao, resolverFusoExibicao } from "@/server/operacao/fuso-exibicao";
import { AdiantamentoFormulario } from "./Formulario";

const horas = (minutos: number) => `${minutos} min (${(minutos / 60).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} h)`;

export default async function Pagina({ params, searchParams }: {
 params: Promise<{ matriculaId: string; propostaId: string }>;
 searchParams: Promise<{ pagina?: string }>;
}) {
 await exigirSessaoPagina(Papel.FINANCEIRO);
 const { matriculaId, propostaId } = await params;
 const [versao, preferencia] = await Promise.all([
   prisma.versaoCondicoesAditivo.findFirst({ where: { matriculaId, propostaId }, select: { id: true } }),
   consultarPreferenciaFusoEquipe(),
 ]);
 if (!versao) return <p role="status">Formalize as condições do aditivo antes de preparar o acerto.</p>;
 const pagina = Number((await searchParams).pagina ?? 1);
 const r = await consultarAdiantamentosAditivo({ matriculaId, versaoCondicoesId: versao.id, pagina });
 if (!r.ok || !r.dado) return <p role="alert">{r.ok ? "Consulta indisponível" : r.erro}</p>;
 const d = r.dado, alvo = d.alvo;
 const fusoExibicao = resolverFusoExibicao(preferencia.ok ? preferencia.dado?.fusoExibicao : null, "UTC");
 // Vencimento é data civil: lido no fuso em que o acerto foi preparado, nunca no fuso pessoal.
 const data = (valor: string, fuso: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: fuso, dateStyle: "short" }).format(new Date(valor));
 const instanteAdministrativo = (valor: string) => { const exibicao = formatarInstanteExibicao(valor, fusoExibicao, "UTC"); return `${exibicao.texto} (horário exibido em ${exibicao.fuso}; origem UTC)`; };
 const vigencia = formatarInstanteExibicao(d.vigenciaInicio, fusoExibicao, "UTC");
 return <main className="space-y-5"><Link href="/financeiro" className="underline">Voltar ao Financeiro</Link>
 <h1 className="text-2xl">Acerto do adiantamento por aditivo</h1>
 <p>Matrícula {matriculaId} · versão contratual {d.versao}</p>
 <p>Vigência aprovada: {vigencia.texto} (horário exibido em {vigencia.fuso}; referência contratual preservada). A aplicação fica disponível a partir desse momento.</p>
 <section className="space-y-1 rounded border p-4"><h2 className="text-xl">Condições contratadas</h2>
  <p>Valor: {alvo.proposto.valor ? `${alvo.proposto.valor.valor} ${alvo.proposto.valor.moeda}` : "sem alteração"} · Tempo: {alvo.proposto.minutos ? horas(alvo.proposto.minutos) : "sem alteração"} · Vencimento: {alvo.proposto.vencimento ?? "sem alteração"}</p>
  {alvo.cobranca && <p>Adiantamento emitido: {alvo.cobranca.valorAtual} {alvo.cobranca.moeda}{alvo.cobranca.minutosAtuais ? ` · ${horas(alvo.cobranca.minutosAtuais)}` : ""}.</p>}
  <p role="status">{alvo.pendencia}</p>
  <p>O aditivo só alcança o adiantamento ainda não pago nem utilizado. Depois de aplicado, a compra de horas confere os minutos e o valor vigentes ao quitar a cobrança.</p>
 </section>
 {alvo.podePreparar && <AdiantamentoFormulario modo="preparar" matriculaId={matriculaId} versaoCondicoesId={versao.id} revisaoHash={d.revisaoHash} />}
 <h2 className="text-xl">Histórico e decisões</h2>
 {!d.propostas.length && <p>Nenhuma proposta de acerto registrada.</p>}
 {d.propostas.map(p => <section key={p.id} className="space-y-2 rounded border p-4">
 <h3>Proposta {p.id} · {p.estado}</h3>
 <p>Valor: {p.valorAnterior} → {p.valorNovo} · Tempo: {horas(p.minutosAnteriores)} → {horas(p.minutosNovos)} · Vencimento: {data(p.vencimentoAnterior,p.fuso)} → {data(p.vencimentoNovo,p.fuso)} ({p.fuso})</p>
 <p>Motivo: {p.motivo}</p><p>Evidência: {p.evidencia}</p>
 {p.decisao && <p>Decisão: {p.decisao.motivo}</p>}
 {p.podeDecidir && <AdiantamentoFormulario modo="decidir" propostaId={p.id} />}
 {p.podeSolicitarAplicacao && <AdiantamentoFormulario modo="aplicar" propostaId={p.id} />}
 {p.aplicadaEm && <p>Aplicado em {instanteAdministrativo(p.aplicadaEm)}.</p>}
 </section>)}
 <nav className="flex gap-4">{d.pagina>1 && <Link href={`?pagina=${d.pagina-1}`}>Anterior</Link>}{d.temProxima && <Link href={`?pagina=${d.pagina+1}`}>Próxima</Link>}</nav>
 </main>;
}
