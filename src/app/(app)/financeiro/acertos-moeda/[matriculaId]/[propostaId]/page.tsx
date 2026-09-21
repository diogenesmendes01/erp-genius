import Link from "next/link";
import { Papel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarMoedasAditivo } from "@/server/contratos/moeda-aditivo";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { formatarInstanteExibicao, resolverFusoExibicao } from "@/server/operacao/fuso-exibicao";
import { MoedaFormulario } from "./Formulario";

export default async function Pagina({ params }: { params: Promise<{ matriculaId: string; propostaId: string }> }) {
 await exigirSessaoPagina(Papel.FINANCEIRO);
 const { matriculaId, propostaId } = await params;
 const [versao, preferencia] = await Promise.all([
   prisma.versaoCondicoesAditivo.findFirst({ where: { matriculaId, propostaId }, select: { id: true } }),
   consultarPreferenciaFusoEquipe(),
 ]);
 if (!versao) return <p role="status">Formalize as condições do aditivo antes de preparar a troca de moeda.</p>;
 const r = await consultarMoedasAditivo({ matriculaId, versaoCondicoesId: versao.id });
 if (!r.ok || !r.dado) return <p role="alert">{r.ok ? "Consulta indisponível" : r.erro}</p>;
 const d = r.dado, alvo = d.alvo;
 const fusoExibicao = resolverFusoExibicao(preferencia.ok ? preferencia.dado?.fusoExibicao : null, "UTC");
 const instante = (valor: string) => { const e = formatarInstanteExibicao(valor, fusoExibicao, "UTC"); return `${e.texto} (horário exibido em ${e.fuso}; origem UTC)`; };
 return <main className="space-y-5"><Link href="/financeiro" className="underline">Voltar ao Financeiro</Link>
 <h1 className="text-2xl">Troca de moeda por aditivo</h1>
 <p>Matrícula {matriculaId} · versão contratual {d.versao}</p>
 <p>Vigência aprovada: {instante(d.vigenciaInicio)}. A aplicação fica disponível a partir desse momento.</p>
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
 {!d.propostas.length && <p>Nenhuma proposta de troca registrada.</p>}
 {d.propostas.map(p => <section key={p.id} className="space-y-2 rounded border p-4">
 <h3>Proposta {p.id} · {p.estado}</h3><p>{p.moedaAnterior} → {p.moedaNova}</p>
 <p>Motivo: {p.motivo}</p><p>Evidência: {p.evidencia}</p>
 {p.decisao && <p>Decisão: {p.decisao.motivo}</p>}
 {p.podeDecidir && <MoedaFormulario modo="decidir" propostaId={p.id} />}
 {p.podeSolicitarAplicacao && <MoedaFormulario modo="aplicar" propostaId={p.id} />}
 {p.aplicadaEm && <p>Aplicada em {instante(p.aplicadaEm)}.</p>}
 </section>)}
 </main>;
}
