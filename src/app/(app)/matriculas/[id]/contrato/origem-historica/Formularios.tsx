"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { decidirOrigemContratualHistorica } from "@/server/contratos/origem-historica";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { botaoClasses } from "@/components/Botao";
import { CampoTexto } from "@/components/CampoTexto";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { MSG_DECISAO_INCERTA } from "@/lib/mensagens";
import type { Resultado } from "@/server/_shared/resultado";

const texto = (form: FormData, campo: string) => String(form.get(campo) ?? "").trim();
const campo = "ml-2 rounded border p-2";

/** POST multipart da rota privada; a resposta já vem no formato `{ ok, dado | erro }` das actions. Falha de rede lança e vira "incerto". */
async function enviarOrigem(matriculaId: string, envio: FormData): Promise<Resultado<{ id: string }>> {
 const resposta = await fetch(`/api/matriculas/${encodeURIComponent(matriculaId)}/origem-historica`, { method: "POST", body: envio });
 const r = await resposta.json() as { ok?: boolean; dado?: { id: string }; erro?: string };
 return r.ok ? { ok: true, dado: r.dado } : { ok: false, erro: r.erro ?? "Não foi possível registrar a origem histórica." };
}

/** Transcrição do contrato legado: só o que for declarado fica estruturado. O PDF assinado vai junto, por multipart. */
export function RegistrarOrigemHistorica({ matriculaId, moeda, regime }: { matriculaId: string; moeda: string; regime: "MENSALIDADE" | "HORA_PARTICULAR" | null }) {
 const router = useRouter();
 // Chave de idempotência estável entre tentativas: reenviar os mesmos dados devolve o registro já gravado.
 const acao = useAcaoCliente({ idempotente: true });
 const [concluido, setConcluido] = useState(false);
 const [regimeEscolhido, setRegime] = useState<"MENSALIDADE" | "HORA_PARTICULAR">(regime ?? "MENSALIDADE");
 const [comAdiantamento, setComAdiantamento] = useState(false);
 const chave = useRef<string | null>(null);
 return <form className="space-y-3 rounded border p-4" onSubmit={async evento => {
  evento.preventDefault(); if (acao.ocupado || concluido) return;
  const form = new FormData(evento.currentTarget);
  const parte = (prefixo: string) => { const nome = texto(form, `${prefixo}Nome`); if (!nome) return undefined;
   return { nome, ...(texto(form, `${prefixo}Documento`) ? { documento: texto(form, `${prefixo}Documento`) } : {}), ...(texto(form, `${prefixo}Email`) ? { email: texto(form, `${prefixo}Email`) } : {}), ...(texto(form, `${prefixo}Endereco`) ? { endereco: texto(form, `${prefixo}Endereco`) } : {}) }; };
  const transcricao = { moeda, aluno: parte("aluno"), ...(parte("pagador") ? { pagador: parte("pagador") } : {}), taxa: { valor: texto(form, "taxaValor"), vencimento: texto(form, "taxaVencimento") },
   aulas: regimeEscolhido === "MENSALIDADE"
    ? { regime: "MENSALIDADE", valor: texto(form, "mensalidadeValor"), primeiroVencimento: texto(form, "primeiroVencimento"), cobertura: { referencia: texto(form, "coberturaReferencia"), inicio: texto(form, "coberturaInicio") } }
    : { regime: "HORA_PARTICULAR", valorHora: texto(form, "valorHora"), ...(comAdiantamento ? { adiantamento: { minutos: Number(texto(form, "adiantamentoMinutos")), vencimento: texto(form, "adiantamentoVencimento") } } : {}) } };
  chave.current ??= crypto.randomUUID();
  const envio = new FormData();
  const pdf = form.get("pdfAssinado"); if (pdf instanceof File) envio.set("pdfAssinado", pdf);
  envio.set("referencia", texto(form, "referencia")); envio.set("assinadoEm", texto(form, "assinadoEm")); envio.set("motivo", texto(form, "motivo"));
  envio.set("transcricao", JSON.stringify(transcricao)); envio.set("chaveIdempotencia", chave.current);
  const d = await acao.executar(() => enviarOrigem(matriculaId, envio), "Origem histórica registrada. Outro administrador precisa conferir o PDF e a transcrição.");
  // Recusa de negócio: os dados podem ser corrigidos, e a próxima tentativa leva chave nova.
  if (d?.tipo === "erro") chave.current = null;
  if (d?.tipo === "ok") { setConcluido(true); router.refresh(); }
 }}>
 <h2 className="text-lg">Registrar origem contratual histórica</h2>
 <p className="text-sm">Transcreva exatamente o que consta no contrato assinado. Nada é presumido: condições não transcritas não ficam estruturadas nem podem ser alteradas por aditivo. Moeda da matrícula: {moeda}.</p>
 <fieldset disabled={acao.ocupado || concluido} className="space-y-2">
  <label className="block">PDF assinado<input type="file" name="pdfAssinado" accept="application/pdf" required className={campo} /></label>
  <label className="block">Referência do contrato (número, pasta, identificação)<input name="referencia" required minLength={2} maxLength={200} className={campo} /></label>
  <label className="block">Data da assinatura<input type="date" name="assinadoEm" required className={campo} /></label>
  <fieldset className="space-y-1 rounded border p-2"><legend>Aluno</legend>
   <label className="block">Nome<input name="alunoNome" required className={campo} /></label>
   <label className="block">Documento<input name="alunoDocumento" className={campo} /></label>
   <label className="block">E-mail<input name="alunoEmail" type="email" className={campo} /></label>
   <label className="block">Endereço<input name="alunoEndereco" className={campo} /></label>
  </fieldset>
  <fieldset className="space-y-1 rounded border p-2"><legend>Pagador (se distinto do aluno)</legend>
   <label className="block">Nome<input name="pagadorNome" className={campo} /></label>
   <label className="block">Documento<input name="pagadorDocumento" className={campo} /></label>
   <label className="block">E-mail<input name="pagadorEmail" type="email" className={campo} /></label>
   <label className="block">Endereço<input name="pagadorEndereco" className={campo} /></label>
  </fieldset>
  <label className="block">Taxa de matrícula ({moeda})<input name="taxaValor" required inputMode="decimal" pattern="^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$" className={campo} /></label>
  <label className="block">Vencimento da taxa<input type="date" name="taxaVencimento" required className={campo} /></label>
  <label className="block">Regime<select value={regimeEscolhido} onChange={e => setRegime(e.target.value as "MENSALIDADE" | "HORA_PARTICULAR")} disabled={!!regime} className={campo}><option value="MENSALIDADE">Mensalidade</option><option value="HORA_PARTICULAR">Particular por hora</option></select>{regime && <span className="ml-2 text-sm">(fixado pela preparação comercial)</span>}</label>
  {regimeEscolhido === "MENSALIDADE" ? <>
   <label className="block">Valor da mensalidade ({moeda})<input name="mensalidadeValor" required inputMode="decimal" pattern="^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$" className={campo} /></label>
   <label className="block">Vencimento da primeira mensalidade<input type="date" name="primeiroVencimento" required className={campo} /></label>
   <label className="block">Referência da cobertura<select name="coberturaReferencia" className={campo}><option value="MES_CIVIL">Mês civil</option><option value="CICLO_MATRICULA">Ciclo da matrícula</option></select></label>
   <label className="block">Início da primeira cobertura<input type="date" name="coberturaInicio" required className={campo} /></label>
  </> : <>
   <label className="block">Preço por hora de 60 minutos ({moeda})<input name="valorHora" required inputMode="decimal" pattern="^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$" className={campo} /></label>
   <label className="block"><input type="checkbox" checked={comAdiantamento} onChange={e => setComAdiantamento(e.target.checked)} /> O contrato prevê adiantamento de horas</label>
   {comAdiantamento && <>
    <label className="block">Minutos do adiantamento<input name="adiantamentoMinutos" required inputMode="numeric" pattern="^[1-9]\d*$" className={campo} /></label>
    <label className="block">Vencimento do adiantamento<input type="date" name="adiantamentoVencimento" required className={campo} /></label>
   </>}
  </>}
  <label className="block">Motivo<CampoTexto name="motivo" required minLength={5} maxLength={2000} className="block w-full rounded border p-2" /></label>
 </fieldset>
 <button type="submit" disabled={acao.ocupado || concluido} className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>{concluido ? "Registrada" : acao.ocupado ? "Enviando…" : "Registrar para conferência"}</button>
 <FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} />
 </form>;
}

/** Conferência dupla: quem decide digita os hashes que conferiu (copiados da tela após abrir o PDF e reler a transcrição). */
export function DecidirOrigemHistorica({ propostaId }: { propostaId: string }) {
 // A decisão não leva chave; repetir a mesma decisão devolve a já registrada (MSG_DECISAO_INCERTA na falha de transporte).
 const router = useRouter(), acao = useAcaoCliente({ idempotente: false });
 const [concluido, setConcluido] = useState(false);
 return <form className="space-y-3 rounded border p-3" onSubmit={async evento => {
  evento.preventDefault(); if (acao.ocupado || concluido) return;
  const form = new FormData(evento.currentTarget);
  const d = await acao.executar(() => decidirOrigemContratualHistorica({ propostaId, aprovada: form.get("decisao") === "aprovar", motivo: texto(form, "motivo"), pdfHashConferido: texto(form, "pdfHashConferido").toLowerCase(), transcricaoHashConferido: texto(form, "transcricaoHashConferido").toLowerCase() }), "Decisão registrada.");
  if (d?.tipo === "incerto") acao.setErro(MSG_DECISAO_INCERTA);
  if (d?.tipo === "ok") { setConcluido(true); router.refresh(); }
 }}>
 <fieldset disabled={acao.ocupado || concluido} className="space-y-2">
  <label className="block">Hash SHA-256 do PDF conferido<input name="pdfHashConferido" required pattern="^[a-fA-F0-9]{64}$" className="block w-full rounded border p-2 font-mono" /></label>
  <label className="block">Hash da transcrição conferida<input name="transcricaoHashConferido" required pattern="^[a-fA-F0-9]{64}$" className="block w-full rounded border p-2 font-mono" /></label>
  <label className="block">Decisão<select name="decisao" className={campo}><option value="aprovar">Aprovar</option><option value="rejeitar">Rejeitar</option></select></label>
  <label className="block">Motivo<CampoTexto name="motivo" required minLength={5} maxLength={2000} className="block w-full rounded border p-2" /></label>
 </fieldset>
 <button type="submit" disabled={acao.ocupado || concluido} className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>{concluido ? "Registrada" : acao.ocupado ? "Processando…" : "Registrar conferência"}</button>
 <FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} />
 </form>;
}
