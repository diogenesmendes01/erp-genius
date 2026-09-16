import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarAssinaturaAditivo } from "@/server/contratos/aditivo-assinatura";
import { consultarProcessoAssinaturaAditivo } from "@/server/contratos/aditivo-envio";
import { consultarConclusaoAssinaturaAditivo } from "@/server/contratos/aditivo-conclusao";
import { consultarConferenciaFinalAditivo } from "@/server/contratos/aditivo-conferencia-final";
import { consultarCondicoesAditivo } from "@/server/contratos/aditivo-condicoes";
import { AssinaturaFormulario } from "../../../AssinaturaFormulario";
import { ProcessoFormulario } from "../../../ProcessoFormulario";
import { ConferenciaFinalFormulario } from "../../../ConferenciaFinalFormulario";
import { CondicoesFormalizadasFormulario } from "../../../CondicoesFormalizadasFormulario";

const papeis: Record<string, string> = { ALUNO: "Aluno", REPRESENTANTE_LEGAL: "Representante legal", RESPONSAVEL_FINANCEIRO: "Responsável financeiro", REPRESENTANTE_EMPRESA: "Representante da empresa", REPRESENTANTE_ESCOLA: "Representante da escola" };
type Processo = { fornecedor: string; ambiente: string; estado: string; tentativaAtual: number; referenciaExterna: string | null; criadoEm: Date; paginaTentativas: number; temMaisTentativas: boolean; tentativas: { numero: number; iniciadaEm: Date; temMaisObservacoes: boolean; observacoes: { resultado: string; referenciaExterna: string | null }[] }[] };
export default async function ConferenciaOriginalAditivoPage({ params, searchParams }: {
  params: Promise<{ id: string; propostaId: string; artefatoId: string }>;
  searchParams: Promise<{ pagina?: string; paginaTentativas?: string }>;
}) {
  await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA);
  const { id, propostaId, artefatoId } = await params, parametros = await searchParams, numero = Number(parametros.pagina ?? 1), numeroTentativas = Number(parametros.paginaTentativas ?? 1);
  const pagina = Number.isInteger(numero) && numero >= 1 && numero <= 100000 ? numero : 1;
  const paginaTentativas = Number.isInteger(numeroTentativas) && numeroTentativas >= 1 && numeroTentativas <= 100000 ? numeroTentativas : 1;
  const r = await consultarAssinaturaAditivo({ matriculaId: id, propostaId, artefatoId, pagina });
  if (!r.ok || !r.dado) return <p role="alert">{r.ok ? "Conferência indisponível." : r.erro}</p>;
  const d = r.dado, base = `/matriculas/${encodeURIComponent(id)}/contrato/aditivos/${encodeURIComponent(propostaId)}`;
  const processoResultado = await consultarProcessoAssinaturaAditivo({ matriculaId: id, propostaId, artefatoId, paginaTentativas });
  if (!processoResultado.ok) return <p role="alert">{processoResultado.erro}</p>;
  const processo = processoResultado.dado as Processo | null, conferenciaAtual = d.revisao && d.historico.find(c => c.revisaoHash === d.revisao?.hash), ambienteFonte = d.revisao?.dados.ambiente;
  const conclusaoResultado = await consultarConclusaoAssinaturaAditivo({ matriculaId: id, propostaId });
  if (!conclusaoResultado.ok) return <p role="alert">{conclusaoResultado.erro}</p>;
  const conclusao = conclusaoResultado.dado;
  const conferenciaFinalResultado = conclusao ? await consultarConferenciaFinalAditivo({ matriculaId: id, propostaId, conclusaoId: conclusao.id }) : null;
  if (conferenciaFinalResultado && !conferenciaFinalResultado.ok) return <p role="alert">{conferenciaFinalResultado.erro}</p>;
  const conferenciaFinal = conferenciaFinalResultado?.dado;
  const vigenciaFormalizada = conferenciaFinal?.revisao?.dados.vigenciaInicio;
  const condicoesResultado = vigenciaFormalizada ? await consultarCondicoesAditivo({ matriculaId: id, em: vigenciaFormalizada }) : null;
  if (condicoesResultado && !condicoesResultado.ok) return <p role="alert">{condicoesResultado.erro}</p>;
  const condicoesDaProposta = condicoesResultado?.dado?.propostaId === propostaId ? condicoesResultado.dado : null;
  const atual = `${base}/originais/${encodeURIComponent(artefatoId)}`;
  return <div className="space-y-4"><Link className="underline" href={base}>Voltar ao aditivo</Link>
    <h1 className="text-2xl">Conferência do original para assinatura</h1>
    <a className="underline" target="_blank" rel="noopener noreferrer" href={`/api/matriculas/${encodeURIComponent(id)}/aditivos/${encodeURIComponent(propostaId)}/originais/${encodeURIComponent(artefatoId)}/pdf`}>Abrir PDF original preservado</a>
    <p>Esta conferência registra a revisão do documento. O envio para assinatura e as aprovações comerciais/financeiras aplicáveis ainda têm etapas próprias.</p>
    {d.pendencia && <p role="alert">{d.pendencia}</p>}
    {d.revisao && <><section className="space-y-2 rounded border p-4"><h2 className="text-xl">Documento e participantes</h2>
      {d.revisao.dados.ambiente === "SANDBOX" && <p role="status">Ambiente de teste: não comprova formalização em produção.</p>}
      <p>Proposta versão {d.revisao.dados.versaoProposta} · conferência de participantes versão {d.revisao.dados.conferenciaVersao}.</p>
      <p>Modelo {d.revisao.dados.modelo.codigo} · versão {d.revisao.dados.modelo.versao}.</p>
      <p>Vigência: {d.revisao.dados.vigenciaInicio.replace("T", " ").replace("Z", " UTC")}.</p>
      {d.revisao.dados.participantes.map(p => <div className="border-t pt-2" key={p.papel}><h3 className="font-medium">{papeis[p.papel] ?? p.papel} · {p.etapa === "CLIENTE" ? "Cliente primeiro" : "Escola após cliente"}</h3><p>{p.identidade.nome}</p><p>{p.identidade.email}</p><p>Documento: {p.identidade.documento}</p></div>)}
    </section><AssinaturaFormulario matriculaId={id} propostaId={propostaId} artefatoId={artefatoId} revisaoHash={d.revisao.hash} /></>}
    {processo ? <section className="space-y-3 rounded border p-4"><h2 className="text-xl">Processo de assinatura preparado</h2><p>Fornecedor: {processo.fornecedor} · ambiente: {processo.ambiente}.</p><p>Estado: {processo.estado}. Tentativa atual: {processo.tentativaAtual}.</p><p>Preparado em {processo.criadoEm.toISOString().replace("T", " ").slice(0, 19)} UTC.</p>{processo.referenciaExterna && <p>Referência externa registrada: {processo.referenciaExterna}.</p>}<h3 className="font-medium">Histórico de tentativas</h3>{processo.tentativas.length ? <><ul className="space-y-2">{processo.tentativas.map(t => <li className="rounded border p-2" key={t.numero}>Tentativa {t.numero} · {t.iniciadaEm.toISOString().replace("T", " ").slice(0, 19)} UTC{t.observacoes.map((o, indice) => <p key={indice}>Resultado: {o.resultado}{o.referenciaExterna ? ` · referência ${o.referenciaExterna}` : ""}</p>)}{t.temMaisObservacoes && <p role="status">Há observações anteriores fora deste resumo. A consulta de observações ainda não possui paginação.</p>}</li>)}</ul><nav aria-label="Páginas de tentativas" className="flex gap-3">{processo.paginaTentativas > 1 && <Link className="underline" href={`${atual}?pagina=${pagina}&paginaTentativas=${processo.paginaTentativas - 1}`}>Tentativas mais recentes</Link>}<span>Página {processo.paginaTentativas}</span>{processo.temMaisTentativas && <Link className="underline" href={`${atual}?pagina=${pagina}&paginaTentativas=${processo.paginaTentativas + 1}`}>Tentativas anteriores</Link>}</nav></> : <p role="status">Nenhuma tentativa de envio foi iniciada.</p>}<p role="status">Criar o processo não envia o documento e não registra assinaturas.</p></section> : conferenciaAtual && (ambienteFonte === "SANDBOX" || ambienteFonte === "PRODUCAO") ? <ProcessoFormulario matriculaId={id} propostaId={propostaId} artefatoId={artefatoId} conferenciaId={conferenciaAtual.id} ambiente={ambienteFonte} /> : <p role="status">Registre uma conferência correspondente à revisão atual antes de preparar o processo.</p>}
    {conclusao && <section className="space-y-2 rounded border p-4"><h2 className="text-xl">Conclusão de assinatura preservada</h2><p>Fornecedor: {conclusao.fornecedor} · ambiente: {conclusao.ambiente}.</p><p>Concluída em {conclusao.concluidaEm.toISOString().replace("T", " ").slice(0, 19)} UTC.</p><p>Assinaturas preservadas: {Array.isArray(conclusao.assinaturas) ? conclusao.assinaturas.length : 0}.</p><a className="block underline" target="_blank" rel="noopener noreferrer" href={`/api/matriculas/${encodeURIComponent(id)}/aditivos/${encodeURIComponent(propostaId)}/assinaturas/${encodeURIComponent(conclusao.id)}/pdf`}>Abrir PDF assinado preservado</a><a className="block underline" href={`/api/matriculas/${encodeURIComponent(id)}/aditivos/${encodeURIComponent(propostaId)}/assinaturas/${encodeURIComponent(conclusao.id)}/evidencias`}>Baixar evidências preservadas</a><p role="status">A consulta preserva os arquivos recebidos; ela não confirma aplicação das condições.</p></section>}
    {conclusao && conferenciaFinal && <section className="space-y-3 rounded border p-4"><h2 className="text-xl">Conferência final</h2>{conferenciaFinal.pendencia && <p role="alert">{conferenciaFinal.pendencia}</p>}{conferenciaFinal.historico && <p role="status">Conferência preservada: {conferenciaFinal.historico.autor} · {conferenciaFinal.historico.motivo}</p>}{conferenciaFinal.revisao && !conferenciaFinal.historico ? <ConferenciaFinalFormulario matriculaId={id} propostaId={propostaId} conclusaoId={conclusao.id} revisaoHash={conferenciaFinal.revisao.hash} /> : <p role="status">A revisão atual não permite nova conferência; o histórico permanece disponível.</p>}</section>}
    {conclusao?.ambiente === "PRODUCAO" && conferenciaFinal?.revisao && conferenciaFinal.historico && <section className="space-y-3 rounded border p-4">{condicoesDaProposta ? <><h2 className="text-xl">Condições formalizadas</h2><p>Versão {condicoesDaProposta.versao} registrada para esta proposta em {condicoesDaProposta.vigenciaInicio.toISOString().replace("T", " ").slice(0, 19)} UTC.</p></> : <CondicoesFormalizadasFormulario matriculaId={id} propostaId={propostaId} conclusaoId={conclusao.id} revisaoHash={conferenciaFinal.revisao.hash} />}</section>}
    <section className="space-y-3 rounded border p-4"><h2 className="text-xl">Conferências registradas</h2>
      {!d.historico.length && <p>Nenhum registro nesta página.</p>}
      {d.historico.map(c => <article className="rounded border p-3" key={c.id}><p>{c.autor} · {c.criadaEm.toISOString().replace("T", " ").slice(0, 19)} UTC</p><p className="whitespace-pre-wrap">{c.motivo}</p><p>{d.revisao?.hash === c.revisaoHash ? "Corresponde à revisão atual." : "Conferência histórica; validade atual não confirmada."}</p></article>)}
      <nav aria-label="Páginas de conferências do original" className="flex gap-3">{pagina > 1 && <Link className="underline" href={`${atual}?pagina=${pagina - 1}`}>Anteriores</Link>}<span>Página {pagina}</span>{d.temProxima && <Link className="underline" href={`${atual}?pagina=${pagina + 1}`}>Próximas</Link>}</nav>
    </section>
  </div>;
}
