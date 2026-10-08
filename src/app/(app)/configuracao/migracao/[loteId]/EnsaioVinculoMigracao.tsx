"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ensaiarVinculoMigracao, revisarCorrespondenciaProdutoMigracao, revisarCorrespondenciaStatusMatriculaMigracao, revisarCorrespondenciaTurmaMigracao } from "@/server/migracao/ensaio-vinculo";
import { formatarInstanteExibicao } from "@/server/operacao/fuso-exibicao";
import type { Resultado } from "@/server/_shared/resultado";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { botaoClasses } from "@/components/Botao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { EstadoVazio } from "@/components/EstadoVazio";
import { RESULTADO_ENSAIO_VINCULO_MIGRACAO_LABEL, STATUS_MATRICULA_LABEL } from "@/lib/labels";

type Oferta = { produtoId: string; paisId: string; moeda: string; rotulo: string };
type Turma = { id: string; rotulo: string };
type AtualProduto = Oferta & { id: string; versao: number; ativa: boolean };
type AtualTurma = { id: string; turmaId: string; versao: number; ativa: boolean; rotulo: string };
type AtualStatus = { id: string; versao: number; ativa: boolean; destino: string };
type Ensaio = { resultado: "REQUISITO_AUSENTE" | "PRONTO_PARA_REVISAO" | "DIVERGENTE"; requisitos: string[]; criadoEm: Date; ensaiadoPor: { nome: string } };
const resultado: Readonly<Record<Ensaio["resultado"], string>> = RESULTADO_ENSAIO_VINCULO_MIGRACAO_LABEL;
const requisito: Record<string, string> = { MAPA_ALUNO_AUSENTE: "o aluno da origem ainda não está associado a um cadastro", CORRESPONDENCIA_PRODUTO_AUSENTE_OU_REVOGADA: "falta uma correspondência ativa de produto", PAIS_OU_MOEDA_DIVERGENTE: "o país ou a moeda da oferta não confere", CORRESPONDENCIA_TURMA_AUSENTE_OU_REVOGADA: "falta uma correspondência ativa de turma", CORRESPONDENCIA_STATUS_AUSENTE_OU_REVOGADA: "falta uma correspondência ativa de situação", CONTRATO_HISTORICO_EXIGE_EVIDENCIA: "o contrato histórico ainda precisa de evidência", PAGAMENTO_HISTORICO_EXIGE_EVIDENCIA: "o pagamento histórico ainda precisa de evidência" };
const status = STATUS_MATRICULA_LABEL;
const textoRequisito = (codigo: string) => requisito[codigo] ?? (codigo.startsWith("PENDENCIA_PREPARACAO_") ? "há uma pendência na fotografia de origem" : "há um requisito pendente nesta conferência");
/** Dispara a revisão de uma correspondência (`ativa`: registrar; senão, revogar). O texto de sucesso é do painel. */
type Executar = (acao: () => Promise<Resultado<unknown>>, ativa: boolean) => Promise<void>;
type Bloco = "produto" | "turma" | "status" | "ensaio";

export function EnsaioVinculoMigracao({ linhaId, origem, produtoOrigemId, turmaOrigemId, statusOrigem, produtoAtual, turmaAtual, statusAtual, ofertasProduto, turmas, ensaios, preferenciaFusoExibicao = null }: { linhaId: string; origem: string; produtoOrigemId: string | null; turmaOrigemId: string | null; statusOrigem: string | null; produtoAtual: AtualProduto | null; turmaAtual: AtualTurma | null; statusAtual: AtualStatus | null; ofertasProduto: Oferta[]; turmas: Turma[]; ensaios: Ensaio[]; preferenciaFusoExibicao?: string | null }) {
  const router = useRouter();
  // Revisões e ensaio sem chave de idempotência: na falha de transporte, conferir antes de repetir (MSG_RESULTADO_INCERTO_SEM_CHAVE).
  const acao = useAcaoCliente({ idempotente: false }); const ocupado = acao.ocupado;
  // Uma ação por vez no painel (o ocupado trava todos os blocos); o resultado aparece no bloco que a disparou.
  const [bloco, setBloco] = useState<Bloco | null>(null);
  async function executarNoBloco(alvo: Bloco, fn: () => Promise<Resultado<unknown>>, sucesso: string) {
    if (acao.ocupado) return;
    setBloco(alvo);
    const d = await acao.executar(fn, sucesso);
    if (d?.tipo === "ok") router.refresh();
  }
  const feedback = (alvo: Bloco) => <FeedbackAcao erro={bloco === alvo ? acao.erro : null} sucesso={bloco === alvo ? acao.sucesso : null} />;
  return <div className="mt-3 space-y-3 rounded border border-blue-200 bg-blue-50 p-3 text-xs"><p>O ensaio registra correspondências e requisitos. Ele não cria matrícula, alocação, cobrança, aceite ou presença.</p>
    {produtoOrigemId && <><Produto origem={origem} produtoOrigemId={produtoOrigemId} atual={produtoAtual} ofertas={ofertasProduto} ocupado={ocupado} executar={(fn, ativa) => executarNoBloco("produto", fn, ativa ? "Correspondência de produto registrada." : "Correspondência de produto revogada.")} />{feedback("produto")}</>}
    {turmaOrigemId && <><TurmaFormulario origem={origem} turmaOrigemId={turmaOrigemId} atual={turmaAtual} turmas={turmas} ocupado={ocupado} executar={(fn, ativa) => executarNoBloco("turma", fn, ativa ? "Correspondência de turma registrada." : "Correspondência de turma revogada.")} />{feedback("turma")}</>}
    {statusOrigem && <><StatusFormulario origem={origem} statusOrigem={statusOrigem} atual={statusAtual} ocupado={ocupado} executar={(fn, ativa) => executarNoBloco("status", fn, ativa ? "Correspondência de situação registrada." : "Correspondência de situação revogada.")} />{feedback("status")}</>}
    <button type="button" className={botaoClasses({ variante: "secundario", tamanho: "sm" })} disabled={ocupado} onClick={() => executarNoBloco("ensaio", () => ensaiarVinculoMigracao({ linhaId }), "Ensaio registrado. O histórico abaixo foi atualizado.")}>{ocupado ? "Conferindo…" : "Ensaiar vínculo"}</button>
    {feedback("ensaio")}<Historico ensaios={ensaios} preferenciaFusoExibicao={preferenciaFusoExibicao} /></div>;
}

function Produto({ origem, produtoOrigemId, atual, ofertas, ocupado, executar }: { origem: string; produtoOrigemId: string; atual: AtualProduto | null; ofertas: Oferta[]; ocupado: boolean; executar: Executar }) {
  const [i, setI] = useState(""); const oferta = i ? ofertas[Number(i) - 1] : null;
  const salvar = (ativa: boolean) => { const alvo = ativa ? oferta : atual; if (!alvo) return; return executar(() => revisarCorrespondenciaProdutoMigracao({ origem, produtoOrigemId, produtoId: alvo.produtoId, paisId: alvo.paisId, moeda: alvo.moeda, ativa, ...(!ativa ? { revisaoEsperada: { id: atual!.id, versao: atual!.versao } } : {}) }), ativa); };
  return <fieldset className="rounded border bg-surface p-2"><legend className="px-1 font-medium">Produto da origem: {produtoOrigemId}</legend>{atual ? <p className="mb-1">Vigente: {atual.rotulo} · versão {atual.versao} · {atual.ativa ? "ativa" : "revogada"}</p> : <p className="mb-1">Sem correspondência vigente.</p>}<label>Oferta de destino<select className="ml-2 rounded border p-1" value={i} onChange={(e) => setI(e.target.value)}><option value="">Selecione uma oferta</option>{ofertas.map((o, indice) => <option key={`${o.produtoId}-${o.paisId}`} value={indice + 1}>{o.rotulo}</option>)}</select></label><Acoes ocupado={ocupado} podeSalvar={!!oferta} podeRevogar={!!atual?.ativa} salvar={salvar} /></fieldset>;
}

function TurmaFormulario({ origem, turmaOrigemId, atual, turmas, ocupado, executar }: { origem: string; turmaOrigemId: string; atual: AtualTurma | null; turmas: Turma[]; ocupado: boolean; executar: Executar }) {
  const [turmaId, setTurmaId] = useState(""); const salvar = (ativa: boolean) => { const alvo = ativa ? turmaId : atual?.turmaId; if (!alvo) return; return executar(() => revisarCorrespondenciaTurmaMigracao({ origem, turmaOrigemId, turmaId: alvo, ativa, ...(!ativa ? { revisaoEsperada: { id: atual!.id, versao: atual!.versao } } : {}) }), ativa); };
  return <fieldset className="rounded border bg-surface p-2"><legend className="px-1 font-medium">Turma da origem: {turmaOrigemId}</legend>{atual ? <p className="mb-1">Vigente: {atual.rotulo} · versão {atual.versao} · {atual.ativa ? "ativa" : "revogada"}</p> : <p className="mb-1">Sem correspondência vigente.</p>}<label>Turma de destino<select className="ml-2 rounded border p-1" value={turmaId} onChange={(e) => setTurmaId(e.target.value)}><option value="">Selecione uma turma</option>{turmas.map((t) => <option key={t.id} value={t.id}>{t.rotulo}</option>)}</select></label><Acoes ocupado={ocupado} podeSalvar={!!turmaId} podeRevogar={!!atual?.ativa} salvar={salvar} /></fieldset>;
}

function StatusFormulario({ origem, statusOrigem, atual, ocupado, executar }: { origem: string; statusOrigem: string; atual: AtualStatus | null; ocupado: boolean; executar: Executar }) {
  const [statusDestino, setStatusDestino] = useState(""); const salvar = (ativa: boolean) => { const alvo = ativa ? statusDestino : atual?.destino; if (!alvo) return; return executar(() => revisarCorrespondenciaStatusMatriculaMigracao({ origem, statusOrigem, statusDestino: alvo, ativa, ...(!ativa ? { revisaoEsperada: { id: atual!.id, versao: atual!.versao } } : {}) }), ativa); };
  return <fieldset className="rounded border bg-surface p-2"><legend className="px-1 font-medium">Situação da origem: {statusOrigem}</legend>{atual ? <p className="mb-1">Vigente: {status[atual.destino as keyof typeof status]} · versão {atual.versao} · {atual.ativa ? "ativa" : "revogada"}</p> : <p className="mb-1">Sem correspondência vigente.</p>}<label>Situação de destino<select className="ml-2 rounded border p-1" value={statusDestino} onChange={(e) => setStatusDestino(e.target.value)}><option value="">Selecione uma situação</option>{Object.entries(status).map(([v, r]) => <option key={v} value={v}>{r}</option>)}</select></label><Acoes ocupado={ocupado} podeSalvar={!!statusDestino} podeRevogar={!!atual?.ativa} salvar={salvar} /></fieldset>;
}

function Acoes({ ocupado, podeSalvar, podeRevogar, salvar }: { ocupado: boolean; podeSalvar: boolean; podeRevogar: boolean; salvar: (ativa: boolean) => Promise<void> | undefined }) { return <div className="mt-2 flex gap-2"><button type="button" disabled={ocupado || !podeSalvar} className={botaoClasses({ variante: "secundario", tamanho: "sm" })} onClick={() => salvar(true)}>Salvar correspondência</button><button type="button" disabled={ocupado || !podeRevogar} className={botaoClasses({ variante: "perigo", tamanho: "sm" })} onClick={() => salvar(false)}>Revogar correspondência</button></div>; }
function Historico({ ensaios, preferenciaFusoExibicao }: { ensaios: Ensaio[]; preferenciaFusoExibicao: string | null }) {
  const instanteAdministrativo = (valor: Date) => {
    const exibicao = formatarInstanteExibicao(valor, preferenciaFusoExibicao, "UTC");
    return `${exibicao.texto} (horário exibido em ${exibicao.fuso}; origem UTC)`;
  };
  return <div><strong>Histórico de ensaios</strong>{ensaios.length === 0 ? <EstadoVazio className="mt-1">Ainda não há ensaio registrado para esta fotografia.</EstadoVazio> : <ul className="mt-1 space-y-2">{ensaios.map((e, i) => <li key={`${e.criadoEm.toISOString()}-${i}`} className="rounded border bg-surface p-2"><p>{resultado[e.resultado]} por {e.ensaiadoPor.nome} em {instanteAdministrativo(e.criadoEm)}</p>{e.requisitos.length > 0 && <ul className="mt-1 list-disc pl-4">{e.requisitos.map((codigo) => <li key={codigo}>{textoRequisito(codigo)}</li>)}</ul>}</li>)}</ul>}</div>; }
