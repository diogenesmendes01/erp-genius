import Link from "next/link";
import { Papel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarMoedasAditivo } from "@/server/contratos/moeda-aditivo";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { formatarInstanteExibicao, resolverFusoExibicao } from "@/server/operacao/fuso-exibicao";
import { MoedaFormulario } from "./Formulario";
import { VoltarPara } from "@/components/VoltarPara";
import { EstadoVazio } from "@/components/EstadoVazio";
import { ESTADO_PROPOSTA_DECIDIDA_LABEL, rotular } from "@/lib/labels";
import { consultarCabecalhoMatricula } from "@/server/matricula/cabecalho";
import { IdentificacaoRegistro } from "@/components/IdentificacaoRegistro";

/** Q173: troca de moeda formalizada em aditivo, só para o futuro e com a matrícula sem pendências na moeda anterior. */
export default async function Pagina({ params, searchParams }: {
 params: Promise<{ matriculaId: string; propostaId: string }>;
 searchParams: Promise<{ pagina?: string }>;
}) {
 const usuario = await exigirSessaoPagina(Papel.FINANCEIRO);
 const { matriculaId, propostaId } = await params;
 const [versao, preferencia, cabecalho] = await Promise.all([
   prisma.versaoCondicoesAditivo.findFirst({ where: { matriculaId, propostaId }, select: { id: true } }),
   consultarPreferenciaFusoEquipe(),
   consultarCabecalhoMatricula(usuario, matriculaId),
 ]);
 if (!versao) return <p role="status">Formalize as condições do aditivo antes de preparar a troca de moeda.</p>;
 // ?pagina inválida (texto, zero, negativa, fracionária ou acima do limite) cai na primeira página, sem erro na tela.
 const solicitada = Number((await searchParams).pagina ?? 1);
 const pagina = Number.isInteger(solicitada) && solicitada >= 1 && solicitada <= 10000 ? solicitada : 1;
 const r = await consultarMoedasAditivo({ matriculaId, versaoCondicoesId: versao.id, pagina });
 if (!r.ok || !r.dado) return <p role="alert">{r.ok ? "Consulta indisponível" : r.erro}</p>;
 const d = r.dado, alvo = d.alvo;
 const fusoExibicao = resolverFusoExibicao(preferencia.ok ? preferencia.dado?.fusoExibicao : null, "UTC");
 const instanteAdministrativo = (valor: string) => { const exibicao = formatarInstanteExibicao(valor, fusoExibicao, "UTC"); return `${exibicao.texto} (horário exibido em ${exibicao.fuso}; origem UTC)`; };
 const vigencia = formatarInstanteExibicao(d.vigenciaInicio, fusoExibicao, "UTC");
 // As pendências comparam a cobertura (data civil) com o dia da vigência no fuso da escola, não no fuso pessoal.
 const diaEscola = (fuso: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: fuso, dateStyle: "short" }).format(new Date(d.vigenciaInicio));
 return <main className="space-y-5"><VoltarPara href="/financeiro/acertos-moeda" />
 <h1 className="text-2xl">Troca de moeda por aditivo</h1>
 {cabecalho && <IdentificacaoRegistro rotulo="Aluno e matrícula desta troca" dados={{ aluno: cabecalho.aluno, alunoHref: `/alunos/${encodeURIComponent(cabecalho.alunoId)}`, matriculaCodigo: cabecalho.codigo, matriculaComplemento: cabecalho.produto }} />}
 <p>Versão contratual {d.versao}</p>
 <p>Vigência aprovada: {vigencia.texto} (horário exibido em {vigencia.fuso}; referência contratual preservada). A aplicação fica disponível a partir desse momento.</p>
 {alvo?.fuso && <p>Dia da vigência na escola: {diaEscola(alvo.fuso)} ({alvo.fuso}). É com esse dia que a cobertura das mensalidades na moeda anterior é comparada.</p>}
 <section className="space-y-2 rounded border p-4"><h2 className="text-xl">Como a troca funciona</h2>
  <p>A nova moeda vale só para o futuro: cobranças já emitidas permanecem na moeda anterior e nada é convertido. Crédito na moeda anterior só quita cobrança da mesma moeda ou é devolvido.</p>
  <p>A matrícula precisa estar sem pendências na moeda anterior. Depois de aplicada, novas condições de cobrança (mensalidade ou horas) devem ser registradas na moeda nova.</p>
  {d.aplicada ? <p role="status">A troca de moeda deste aditivo já foi aplicada.</p> : alvo && <>
   <p>Moeda atual: {alvo.moedaAtual} · Moeda contratada: {alvo.moedaNova ?? "—"}</p>
   <p role="status">{alvo.pendencia}</p>
   {!!alvo.pendencias.length && <ul className="list-disc pl-5">{alvo.pendencias.map(p => <li key={p.codigo}>{p.texto}</li>)}</ul>}
  </>}
 </section>
 {alvo?.podePreparar && <MoedaFormulario modo="preparar" matriculaId={matriculaId} versaoCondicoesId={versao.id} revisaoHash={d.revisaoHash} />}
 <h2 className="text-xl">Histórico e decisões</h2>
 {!d.propostas.length && <EstadoVazio bloco>Nenhuma proposta de troca registrada.</EstadoVazio>}
 {d.propostas.map(p => <section key={p.id} className="space-y-2 rounded border p-4">
 <h3>Proposta de {instanteAdministrativo(p.criadaEm)} · {rotular(ESTADO_PROPOSTA_DECIDIDA_LABEL, p.estado)}</h3>
 <p>{p.moedaAnterior} → {p.moedaNova} · fuso da escola na preparação: {p.fuso}</p>
 <p>Motivo: {p.motivo}</p><p>Evidência: {p.evidencia}</p>
 {p.decisao && <p>Decisão: {p.decisao.motivo}</p>}
 {p.podeDecidir && <MoedaFormulario modo="decidir" propostaId={p.id} />}
 {p.podeSolicitarAplicacao && <MoedaFormulario modo="aplicar" propostaId={p.id} />}
 {p.aplicadaEm && <p>Aplicada em {instanteAdministrativo(p.aplicadaEm)}.</p>}
 </section>)}
 <nav className="flex gap-4">{d.pagina>1 && <Link href={`?pagina=${d.pagina-1}`}>Anterior</Link>}{d.temProxima && <Link href={`?pagina=${d.pagina+1}`}>Próxima</Link>}</nav>
 </main>;
}
