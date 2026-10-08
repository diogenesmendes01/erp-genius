"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { registrarAutorizacaoComunicacaoAcademica, revogarAutorizacaoComunicacaoAcademica } from "@/server/comunicacoes-agenda/autorizacoes";
import { formatarInstanteExibicao } from "@/server/operacao/fuso-exibicao";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { botaoClasses } from "@/components/Botao";
import { CampoTexto } from "@/components/CampoTexto";
import { EstadoVazio } from "@/components/EstadoVazio";
import { useAcaoCliente } from "@/lib/acao-cliente";

type Item = { id: string; responsavelId: string; evidencia: string; vigenteEm: string; revogadaEm: string | null; motivoRevogacao: string | null; responsavel: { nome: string }; autorizadaPor: { nome: string }; revogadaPor: { nome: string } | null };
export function AutorizacoesFormulario({ matriculaId, responsaveis, historico, preferenciaFusoExibicao = null }: { matriculaId: string; responsaveis: { id: string; nome: string }[]; historico: Item[]; preferenciaFusoExibicao?: string | null }) {
  const router = useRouter();
  // Registro e revogação: dois grupos de ação, cada um com seu feedback junto do próprio botão. Sem chave
  // de idempotência: na falha de transporte, conferir antes de repetir (MSG_RESULTADO_INCERTO_SEM_CHAVE).
  const registro = useAcaoCliente({ idempotente: false });
  const revogacao = useAcaoCliente({ idempotente: false });
  // Autorização cuja revogação foi enviada por último: o resultado aparece no cartão dela.
  const [revogacaoAlvo, setRevogacaoAlvo] = useState<string | null>(null);
  const ocupado = registro.ocupado || revogacao.ocupado;
  async function registrar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const f = new FormData(form);
    revogacao.limpar();
    const d = await registro.executar(() => registrarAutorizacaoComunicacaoAcademica({ matriculaId, responsavelId: String(f.get("responsavelId") ?? ""), evidencia: String(f.get("evidencia") ?? "") }), "Autorização registrada.");
    if (d?.tipo === "ok") { form.reset(); router.refresh(); }
  }
  async function revogar(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    // Uma ação por vez: o resultado vai para o cartão de `id`, então nada de trocar o alvo no meio de outra.
    if (ocupado) return;
    const f = new FormData(event.currentTarget);
    registro.limpar();
    setRevogacaoAlvo(id);
    const d = await revogacao.executar(() => revogarAutorizacaoComunicacaoAcademica({ id, motivoRevogacao: String(f.get("motivo") ?? "") }), "Revogação registrada no histórico.");
    if (d?.tipo === "ok") router.refresh();
  }
  return <div className="space-y-5"><form onSubmit={registrar} className="space-y-3 rounded border p-4"><h2 className="text-lg font-medium">Autorizar responsável pedagógico</h2>{!responsaveis.length ? <EstadoVazio role="status">Não há responsável pedagógico vinculado a esta matrícula.</EstadoVazio> : <><label className="block">Responsável<select required name="responsavelId" defaultValue="" className="ml-2 rounded border p-2"><option value="" disabled>Selecione</option>{responsaveis.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}</select></label><label className="block">Evidência<CampoTexto required name="evidencia" minLength={5} maxLength={2000} className="mt-1 block w-full rounded border p-2" /></label><button disabled={ocupado} className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>{ocupado ? "Registrando…" : "Registrar autorização"}</button><FeedbackAcao erro={registro.erro} sucesso={registro.sucesso} /></>}</form>
    <section className="space-y-3"><h2 className="text-lg font-medium">Histórico</h2>{!historico.length && <EstadoVazio>Nenhuma autorização registrada.</EstadoVazio>}{historico.map((item) => { const vigente = formatarInstanteExibicao(item.vigenteEm, preferenciaFusoExibicao, "UTC"), revogada = item.revogadaEm ? formatarInstanteExibicao(item.revogadaEm, preferenciaFusoExibicao, "UTC") : null; return <article key={item.id} className="space-y-2 rounded border p-4"><p><strong>{item.responsavel.nome}</strong> · registrado por {item.autorizadaPor.nome} em {vigente.texto} (horário exibido em {vigente.fuso}; origem UTC)</p><p className="whitespace-pre-wrap">{item.evidencia}</p>{item.revogadaEm ? <p>Revogada por {item.revogadaPor?.nome ?? "usuário indisponível"} em {revogada?.texto} (horário exibido em {revogada?.fuso}; origem UTC): {item.motivoRevogacao}</p> : <form onSubmit={(event) => revogar(event, item.id)} className="space-y-2"><label className="block">Motivo da revogação<CampoTexto required name="motivo" minLength={5} maxLength={2000} className="mt-1 block w-full rounded border p-2" /></label><button disabled={ocupado} className={botaoClasses({ variante: "perigo", tamanho: "lg" })}>Revogar autorização</button></form>}{revogacaoAlvo === item.id && <FeedbackAcao erro={revogacao.erro} sucesso={revogacao.sucesso} />}</article>; })}</section></div>;
}
