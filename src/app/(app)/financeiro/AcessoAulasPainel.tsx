"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { carregarGestaoAcessoAulas, type GestaoAcessoAulas } from "@/server/cobrancas/acesso-aulas-consultas";
import { bloquearAcesso, desbloquearAcesso, decidirSolicitacaoAcessoAulas } from "@/server/cobrancas/acoes";
import { formatarInstanteExibicao } from "@/server/operacao/fuso-exibicao";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { botaoClasses } from "@/components/Botao";
import { CampoTexto } from "@/components/CampoTexto";
import { EstadoVazio } from "@/components/EstadoVazio";

const campo = "w-full rounded-md border border-gray-300 px-3 py-2 text-sm";
const botao = botaoClasses({ variante: "secundario" });

type SolicitacaoAcesso = GestaoAcessoAulas["matriculas"][number]["solicitacoes"][number];

export function HistoricoSolicitacaoAcessoAulas({ solicitacao, preferenciaFusoExibicao = null }: { solicitacao: SolicitacaoAcesso; preferenciaFusoExibicao?: string | null }) {
  const criado = formatarInstanteExibicao(solicitacao.criadoEm, preferenciaFusoExibicao, "UTC");
  const decidido = solicitacao.decididoEm ? formatarInstanteExibicao(solicitacao.decididoEm, preferenciaFusoExibicao, "UTC") : null;
  return <>
    <p className="text-xs text-gray-500">Solicitante: {solicitacao.solicitante} · {criado.texto} (horário exibido em {criado.fuso}; origem UTC)</p>
    {solicitacao.aprovador && <p className="text-xs text-gray-600">Decisão de {solicitacao.aprovador}: {solicitacao.motivoDecisao}{decidido && ` · ${decidido.texto} (horário exibido em ${decidido.fuso}; origem UTC)`}</p>}
  </>;
}

export function AcessoAulasPainel({ matriculaId, alunoId, preferenciaFusoExibicao = null }: { matriculaId?: string; alunoId?: string; preferenciaFusoExibicao?: string | null }) {
  const router = useRouter();
  const [dados, setDados] = useState<GestaoAcessoAulas | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [form, setForm] = useState<{ matriculaId: string; bloquear: boolean } | null>(null);
  const [motivo, setMotivo] = useState("");
  const [motivosDecisao, setMotivosDecisao] = useState<Record<string, string>>({});
  // Pedido e decisão não recebem chave de idempotência (server/cobrancas/acoes.ts:97-105). O servidor só
  // reconhece a repetição idêntica pelo conteúdo (acoes.ts:80 e :115), sem chave — conferir antes de repetir.
  const acao = useAcaoCliente({ idempotente: false });
  // O resultado aparece junto do formulário da matrícula ou da solicitação que disparou a ação.
  const [alvo, setAlvo] = useState<string | null>(null);
  const carregar = useCallback(async () => {
    const resultado = await carregarGestaoAcessoAulas({ matriculaId, alunoId });
    if (!resultado.ok) setErro(resultado.erro);
    else setDados(resultado.dado ?? null);
  }, [matriculaId, alunoId]);
  useEffect(() => {
    let ativo = true;
    void carregarGestaoAcessoAulas({ matriculaId, alunoId }).then((resultado) => {
      if (!ativo) return;
      if (!resultado.ok) setErro(resultado.erro);
      else setDados(resultado.dado ?? null);
    });
    const atualizar = () => { void carregar(); };
    window.addEventListener("acesso-aulas-atualizado", atualizar);
    return () => { ativo = false; window.removeEventListener("acesso-aulas-atualizado", atualizar); };
  }, [matriculaId, alunoId, carregar]);

  async function solicitar() {
    if (!form) return;
    setAlvo(`form:${form.matriculaId}`);
    const d = await acao.executar(() => (form.bloquear ? bloquearAcesso(form.matriculaId, motivo) : desbloquearAcesso(form.matriculaId, motivo)), "Solicitação registrada. Outra pessoa da administração precisa decidir.");
    if (d?.tipo !== "ok") return;
    setForm(null); setMotivo("");
    window.dispatchEvent(new Event("acesso-aulas-atualizado")); router.refresh();
  }
  async function decidir(id: string, aprovar: boolean) {
    setAlvo(`decisao:${id}`);
    const d = await acao.executar(() => decidirSolicitacaoAcessoAulas(id, { aprovar, motivo: motivosDecisao[id] ?? "" }), aprovar ? "Decisão aprovada e registrada." : "Solicitação rejeitada e registrada.");
    if (d?.tipo !== "ok") return;
    window.dispatchEvent(new Event("acesso-aulas-atualizado")); router.refresh();
  }

  return <section className="space-y-3 rounded-lg border border-gray-200 bg-surface p-4" aria-label="Gestão de acesso às aulas">
    <h2 className="font-medium">Acesso às aulas</h2>
    <p className="text-xs text-gray-500">Atraso de 30 dias gera restrição automática. Pedidos manuais exigem motivo e aprovação de outra pessoa da administração.</p>
    {erro && <p role="alert" className="text-sm text-red-700">{erro}</p>}
    {!dados && !erro && <p className="text-sm text-gray-500">Carregando solicitações…</p>}
    {dados?.matriculas.length === 0 && <EstadoVazio>Nenhuma restrição ou solicitação pendente.</EstadoVazio>}
    {dados?.matriculas.map((m) => <article key={m.id} className="space-y-3 border-t border-gray-100 pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium">{m.aluno} · {m.codigo ?? "Matrícula"}</h3>
        <span className={`rounded-full px-2 py-1 text-xs ${m.aulasRegularesPermitidas ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-800"}`}>{m.aulasRegularesPermitidas ? "Contrato ativo, sem restrição" : m.status === "PAUSADA" ? "Contrato pausado" : m.status !== "ATIVA" ? "Contrato não ativo" : "Restrição registrada"}</span>
      </div>
      {(m.manual || m.automatico) && <p className="text-xs text-gray-600">{[m.manual ? "Restrição manual autorizada" : null, m.automatico ? "Restrição automática por atraso" : null].filter(Boolean).join(" · ")}</p>}
      {m.manual && <p className="text-xs text-gray-500">Quitar a dívida não remove a restrição manual; a liberação também exige aprovação.</p>}
      {m.status !== "ATIVA" && <p className="text-xs text-gray-600">A liberação financeira não autoriza aulas regulares enquanto este contrato não estiver ativo. Os outros contratos têm suas próprias condições de acesso.</p>}
      {!m.solicitacoes.some((p) => p.status === "PENDENTE") && (m.status === "ATIVA" || m.manual) && <button className={botao} disabled={acao.ocupado} onClick={() => { setForm({ matriculaId: m.id, bloquear: !m.manual }); setMotivo(""); acao.limpar(); }}>{m.manual ? "Solicitar liberação manual" : "Solicitar restrição manual"}</button>}
      {form?.matriculaId === m.id && <div className="space-y-2">
        <label className="block text-sm">Motivo da {form.bloquear ? "restrição" : "liberação"}<CampoTexto className={campo} rows={2} maxLength={2000} value={motivo} onChange={(e) => setMotivo(e.target.value)} /></label>
        <div className="flex gap-2"><button className={botao} disabled={acao.ocupado || motivo.trim().length < 5} onClick={solicitar}>Enviar solicitação</button><button className={botao} disabled={acao.ocupado} onClick={() => setForm(null)}>Cancelar</button></div>
      </div>}
      {/* Fora do formulário: no sucesso ele fecha, e a confirmação continua visível no lugar do botão. */}
      <FeedbackAcao erro={alvo === `form:${m.id}` ? acao.erro : null} sucesso={alvo === `form:${m.id}` ? acao.sucesso : undefined} />
      {m.solicitacoes.map((p) => <div key={p.id} className="space-y-2 rounded-md bg-gray-50 p-3 text-sm">
        <p className="font-medium">{p.bloquear ? "Restrição manual" : "Liberação manual"} · {p.status === "PENDENTE" ? "Aguardando decisão" : p.status === "APROVADA" ? "Aprovada" : "Rejeitada"}</p>
        <p>{p.motivo}</p>
        <HistoricoSolicitacaoAcessoAulas solicitacao={p} preferenciaFusoExibicao={preferenciaFusoExibicao} />
        {p.podeDecidir && <div className="space-y-2">
          <label className="block text-xs">Motivo da decisão<CampoTexto className={campo} rows={2} maxLength={2000} value={motivosDecisao[p.id] ?? ""} onChange={(e) => setMotivosDecisao((atual) => ({ ...atual, [p.id]: e.target.value }))} /></label>
          <div className="flex gap-2"><button className={botao} disabled={acao.ocupado || (motivosDecisao[p.id] ?? "").trim().length < 5} onClick={() => decidir(p.id, true)}>Aprovar</button><button className={botao} disabled={acao.ocupado || (motivosDecisao[p.id] ?? "").trim().length < 5} onClick={() => decidir(p.id, false)}>Rejeitar</button></div>
        </div>}
        <FeedbackAcao erro={alvo === `decisao:${p.id}` ? acao.erro : null} sucesso={alvo === `decisao:${p.id}` ? acao.sucesso : undefined} />
        {!p.podeDecidir && p.status === "PENDENTE" && <p className="text-xs text-gray-500">Aguardando decisão de outra pessoa da administração.</p>}
      </div>)}
    </article>)}
  </section>;
}
