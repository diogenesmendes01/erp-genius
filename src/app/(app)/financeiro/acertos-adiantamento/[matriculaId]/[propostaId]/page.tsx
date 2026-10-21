import Link from "next/link";
import { Papel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarAdiantamentosAditivo } from "@/server/contratos/adiantamento-aditivo";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { formatarDiaCivilGravado, formatarInstanteExibicao, resolverFusoExibicao } from "@/server/operacao/fuso-exibicao";
import { fusoDaEscola } from "@/server/relatorios/atendimento";
import { AdiantamentoFormulario } from "./Formulario";
import { formatarDataCivil } from "@/lib/data-civil";
import { formatarMoeda } from "@/lib/dinheiro";
import { VoltarPara } from "@/components/VoltarPara";
import { EstadoVazio } from "@/components/EstadoVazio";
import { ESTADO_PROPOSTA_DECIDIDA_LABEL, rotular } from "@/lib/labels";
import { consultarCabecalhoMatricula } from "@/server/matricula/cabecalho";
import { IdentificacaoRegistro } from "@/components/IdentificacaoRegistro";

const horas = (minutos: number) => `${minutos} min (${(minutos / 60).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} h)`;

/** Q172: acerto do adiantamento formalizado em aditivo, só enquanto o adiantamento não foi pago nem utilizado. */
export default async function Pagina({ params, searchParams }: {
 params: Promise<{ matriculaId: string; propostaId: string }>;
 searchParams: Promise<{ pagina?: string }>;
}) {
 const usuario = await exigirSessaoPagina(Papel.FINANCEIRO);
 const { matriculaId, propostaId } = await params;
 const [versao, preferencia, cabecalho, fusoEscola] = await Promise.all([
   prisma.versaoCondicoesAditivo.findFirst({ where: { matriculaId, propostaId }, select: { id: true } }),
   consultarPreferenciaFusoEquipe(),
   consultarCabecalhoMatricula(usuario, matriculaId),
   fusoDaEscola(),
 ]);
 if (!versao) return <p role="status">Formalize as condições do aditivo antes de preparar o acerto.</p>;
 const pagina = Number((await searchParams).pagina ?? 1);
 const r = await consultarAdiantamentosAditivo({ matriculaId, versaoCondicoesId: versao.id, pagina });
 if (!r.ok || !r.dado) return <p role="alert">{r.ok ? "Consulta indisponível" : r.erro}</p>;
 const d = r.dado, alvo = d.alvo;
 // Lote 3 do fuso pessoal: registro, aplicação e vigência são instantes — fuso pessoal; sem preferência, o da escola
 // (antes, UTC), com o fuso escrito. Vencimentos são datas civis gravadas: o dia no fuso em que o acerto foi preparado.
 const fusoExibicao = resolverFusoExibicao(preferencia.ok ? preferencia.dado?.fusoExibicao : null, fusoEscola);
 // Vencimento é data civil: lido no fuso em que o acerto foi preparado, nunca no fuso pessoal.
 const data = (valor: string, fuso: string) => formatarDiaCivilGravado(valor, fuso);
 const instanteAdministrativo = (valor: string) => { const exibicao = formatarInstanteExibicao(valor, fusoExibicao, fusoEscola); return `${exibicao.texto} (horário exibido em ${exibicao.fuso})`; };
 const vigencia = formatarInstanteExibicao(d.vigenciaInicio, fusoExibicao, fusoEscola);
 return <main className="space-y-5"><VoltarPara href="/financeiro" />
 <h1 className="text-2xl">Acerto do adiantamento por aditivo</h1>
 {/* De quem é o acerto: aluno e matrícula pelo código, não o id da URL (docs/43 §6 item 7). */}
 {cabecalho && <IdentificacaoRegistro rotulo="Aluno e matrícula deste acerto" dados={{ aluno: cabecalho.aluno, alunoHref: `/alunos/${encodeURIComponent(cabecalho.alunoId)}`, matriculaCodigo: cabecalho.codigo, matriculaComplemento: cabecalho.produto }} />}
 <p>Versão contratual {d.versao}</p>
 <p>Vigência aprovada: {vigencia.texto} (horário exibido em {vigencia.fuso}; referência contratual preservada). A aplicação fica disponível a partir desse momento.</p>
 <section className="space-y-1 rounded border p-4"><h2 className="text-xl">Condições contratadas</h2>
  <p>Valor: {alvo.proposto.valor ? formatarMoeda(alvo.proposto.valor.valor, alvo.proposto.valor.moeda) : "sem alteração"} · Tempo: {alvo.proposto.minutos ? horas(alvo.proposto.minutos) : "sem alteração"} · Vencimento: {alvo.proposto.vencimento ? formatarDataCivil(alvo.proposto.vencimento) : "sem alteração"}</p>
  {alvo.cobranca && <p>Adiantamento emitido: {formatarMoeda(alvo.cobranca.valorAtual, alvo.cobranca.moeda)}{alvo.cobranca.minutosAtuais ? ` · ${horas(alvo.cobranca.minutosAtuais)}` : ""}.</p>}
  <p role="status">{alvo.pendencia}</p>
  <p>O aditivo só alcança o adiantamento ainda não pago nem utilizado. Depois de aplicado, a compra de horas confere os minutos e o valor vigentes ao quitar a cobrança. A comissão não é recalculada.</p>
 </section>
 {alvo.podePreparar && <AdiantamentoFormulario modo="preparar" matriculaId={matriculaId} versaoCondicoesId={versao.id} revisaoHash={d.revisaoHash} />}
 <h2 className="text-xl">Histórico e decisões</h2>
 {!d.propostas.length && <EstadoVazio bloco>Nenhuma proposta de acerto registrada.</EstadoVazio>}
 {d.propostas.map(p => <section key={p.id} className="space-y-2 rounded border p-4">
 <h3>Proposta de {instanteAdministrativo(p.criadaEm)} · {rotular(ESTADO_PROPOSTA_DECIDIDA_LABEL, p.estado)}</h3>
 <p>Valor: {formatarMoeda(p.valorAnterior, p.moeda)} → {formatarMoeda(p.valorNovo, p.moeda)} · Tempo: {horas(p.minutosAnteriores)} → {horas(p.minutosNovos)} · Vencimento: {data(p.vencimentoAnterior,p.fuso)} → {data(p.vencimentoNovo,p.fuso)} ({p.fuso})</p>
 <p>Motivo: {p.motivo}</p><p>Evidência: {p.evidencia}</p>
 {p.decisao && <p>Decisão: {p.decisao.motivo}</p>}
 {p.podeDecidir && <AdiantamentoFormulario modo="decidir" propostaId={p.id} />}
 {p.podeSolicitarAplicacao && <AdiantamentoFormulario modo="aplicar" propostaId={p.id} />}
 {p.aplicadaEm && <p>Aplicado em {instanteAdministrativo(p.aplicadaEm)}.</p>}
 </section>)}
 <nav className="flex gap-4">{d.pagina>1 && <Link href={`?pagina=${d.pagina-1}`}>Anterior</Link>}{d.temProxima && <Link href={`?pagina=${d.pagina+1}`}>Próxima</Link>}</nav>
 </main>;
}
