import Link from "next/link";
import { Papel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarVencimentosAditivo } from "@/server/contratos/vencimento-aditivo";
import { VencimentoFormulario } from "./Formulario";

export default async function Pagina({ params, searchParams }: {
 params: Promise<{ matriculaId: string; propostaId: string }>;
 searchParams: Promise<{ pagina?: string }>;
}) {
 await exigirSessaoPagina(Papel.FINANCEIRO);
 const { matriculaId, propostaId } = await params;
 const versao = await prisma.versaoCondicoesAditivo.findFirst({ where: { matriculaId, propostaId }, select: { id: true } });
 if (!versao) return <p role="status">Formalize as condições do aditivo antes de preparar o acerto.</p>;
 const pagina = Number((await searchParams).pagina ?? 1);
 const r = await consultarVencimentosAditivo({ matriculaId, versaoCondicoesId: versao.id, pagina });
 if (!r.ok || !r.dado) return <p role="alert">{r.ok ? "Consulta indisponível" : r.erro}</p>;
 const d = r.dado;
 const data = (valor: string, fuso: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: fuso, dateStyle: "short" }).format(new Date(valor));
 return <main className="space-y-5"><Link href="/financeiro" className="underline">Voltar ao Financeiro</Link>
 <h1 className="text-2xl">Acerto do vencimento da primeira mensalidade</h1>
 <p>Matrícula {matriculaId} · versão contratual {d.versao}</p>
 <p>Vigência aprovada: {new Date(d.vigenciaInicio).toISOString().replace("T", " ").slice(0,19)} UTC. A aplicação fica disponível a partir desse momento.</p>
 <p>Novo vencimento contratado: {d.alvo.vencimentoProposto}. {d.alvo.pendencia}</p>
 {d.alvo.podePreparar && <VencimentoFormulario modo="preparar" matriculaId={matriculaId} versaoCondicoesId={versao.id} revisaoHash={d.revisaoHash} />}
 <h2 className="text-xl">Histórico e decisões</h2>
 {!d.propostas.length && <p>Nenhuma proposta de acerto registrada.</p>}
 {d.propostas.map(p => <section key={p.id} className="space-y-2 rounded border p-4">
 <h3>Proposta {p.id} · {p.estado}</h3><p>{data(p.vencimentoAnterior,p.fuso)} → {data(p.vencimentoNovo,p.fuso)} ({p.fuso})</p>
 <p>Motivo: {p.motivo}</p><p>Evidência: {p.evidencia}</p>
 {p.decisao && <p>Decisão: {p.decisao.motivo}</p>}
 {p.podeDecidir && <VencimentoFormulario modo="decidir" propostaId={p.id} />}
 {p.podeSolicitarAplicacao && <VencimentoFormulario modo="aplicar" propostaId={p.id} />}
 {p.reconciliacaoAcesso && <p role="status">Atualização de acesso: {p.reconciliacaoAcesso.concluida ? "concluída" : "pendente de processamento"}. Tentativas: {p.reconciliacaoAcesso.tentativas}. {p.reconciliacaoAcesso.erro}</p>}
 {p.aplicadaEm && <p>Aplicado em {data(p.aplicadaEm,p.fuso)}.</p>}
 </section>)}
 <nav className="flex gap-4">{d.pagina>1 && <Link href={`?pagina=${d.pagina-1}`}>Anterior</Link>}{d.temProxima && <Link href={`?pagina=${d.pagina+1}`}>Próxima</Link>}</nav>
 </main>;
}
