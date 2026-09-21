"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { RegrasHorasSchema } from "@/server/matricula/condicoes-horas-schema";
import { consultarOcorrenciasFinanceiras } from "@/server/matricula/ocorrencia-financeira-consulta";
import { preverConferenciaOcorrenciaHoras } from "@/server/matricula/ocorrencia-financeira-previa";
import { conferirOcorrenciaHoras } from "@/server/matricula/ocorrencia-financeira-conferir";
type Dados = NonNullable<Extract<Awaited<ReturnType<typeof consultarOcorrenciasFinanceiras>>, { ok: true }>["dado"]>;
type Previa = NonNullable<Extract<Awaited<ReturnType<typeof preverConferenciaOcorrenciaHoras>>, { ok: true }>["dado"]>;
const rotulos: Record<string, string> = { REALIZADA: "Aula realizada", FALTA_ALUNO: "Falta do aluno", FALTA_COBRAVEL: "Falta cobrável", CANCELAMENTO_ALUNO: "Cancelamento do aluno", CANCELAMENTO_ESCOLA: "Cancelamento da escola", CANCELAMENTO_NO_PRAZO: "Cancelamento dentro do prazo", CANCELAMENTO_TARDIO: "Cancelamento fora do prazo" };
function Memoria({ snapshot, data }: { snapshot: unknown; data: (v: string) => string }) {
  const r = z.object({ versaoOcorrencia: z.number(), versaoCondicoes: z.number(), regras: RegrasHorasSchema }).safeParse(snapshot);
  if (!r.success) return <p>Memória histórica indisponível para apresentação; requer conferência.</p>;
  return <div className="space-y-2"><p>Informe versão {r.data.versaoOcorrencia} · Condições versão {r.data.versaoCondicoes}</p>
    <p>Preço contratado: {r.data.regras.valorHora} {r.data.regras.moeda} por 60 minutos.</p>
    <p>Vigência: {data(r.data.regras.vigenteDesde)} · Antecedência de cancelamento: {r.data.regras.antecedenciaCancelamentoMinutos} minutos.</p>
    <p>Cláusula de preço: {r.data.regras.clausulaPreco}</p><p>Cláusula de cancelamento: {r.data.regras.clausulaCancelamento}</p></div>;
}
export function ConferenciaHoras({ encontro: e, condicoes, matricula }: { encontro: Dados["encontros"][number]; condicoes: Dados["condicoes"]; matricula: Dados["matricula"] }) {
  const router = useRouter(), [ocupado, iniciar] = useTransition(), [previa, setPrevia] = useState<Previa | null>(null), [mensagem, setMensagem] = useState("");
  const [condicoesId, setCondicoesId] = useState("");
  const chave = useRef({ entrada: "", valor: "" });
  const data = (v: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: e.fusoOrigem }).format(new Date(v));
  const origem = { alunoId: matricula.alunoId, matriculaId: matricula.id, ocorrenciaId: e.ocorrencia?.id ?? "", condicoesId };
  return <article className="space-y-3 rounded border p-4">
    <h2 className="font-medium">{data(e.inicio)} — {data(e.fim)} · {e.fusoOrigem}</h2>
    {e.ocorrencia ? <><p>Informe v{e.ocorrencia.versao} · {rotulos[e.ocorrencia.tipo]} · {e.ocorrencia.autor.nome}</p><p className="whitespace-pre-wrap">{e.ocorrencia.evidencia}</p>{e.ocorrencia.comunicadoEm && <p>Comunicação: {data(e.ocorrencia.comunicadoEm)}</p>}</> : <p>Aguardando informe docente.</p>}
    {e.conferencia ? <section className="space-y-2"><h3>Conferência registrada</h3>
      <p>{rotulos[e.conferencia.desfecho]} · {e.conferencia.minutos} minutos · {e.conferencia.consumoAntecipacao ? "valor preservado da compra" : "valor apurado"}: {e.conferencia.valor} {e.conferencia.moeda}</p>
      <p>{e.conferencia.conferente.nome} · {data(e.conferencia.conferidaEm)}</p><p>{e.conferencia.motivo}</p>
      {e.conferencia.consumoAntecipacao && <p>Reserva antecipada {e.conferencia.consumoAntecipacao.reservaId} da compra {e.conferencia.consumoAntecipacao.reserva.compraId} consumida por esta ocorrência. Não foi criada cobrança, recebimento ou crédito.</p>}
      <details><summary>Memória preservada da conferência</summary><Memoria snapshot={e.conferencia.snapshot} data={data} /></details>
      <p>A emissão da cobrança é uma etapa separada.</p>
    </section> : e.ocorrencia && <>
      <label className="block">Condições aprovadas<select className="ml-2 rounded border p-2" value={condicoesId} disabled={ocupado} onChange={event => { setCondicoesId(event.target.value); setPrevia(null); setMensagem(""); }}>
        <option value="">Selecione a versão aplicável</option>
        {condicoes.filter(c => !!c.regras).map(c => <option key={c.id} value={c.id}>Versão {c.versao} · desde {data(c.regras!.vigenteDesde)} · {c.regras!.valorHora} {c.regras!.moeda}/hora</option>)}
      </select></label>
      <button className="rounded border p-2" disabled={ocupado || !condicoesId} onClick={() => iniciar(async () => {
        setMensagem(""); setPrevia(null);
        try { const r = await preverConferenciaOcorrenciaHoras(origem); if (!r.ok) setMensagem(r.erro); else setPrevia(r.dado ?? null); }
        catch { setMensagem("Não foi possível carregar a prévia."); }
      })}>Conferir prévia</button>
      {previa && <section className="space-y-2 rounded border p-3"><h3>Prévia — ainda não registrada</h3>
        <p>{rotulos[previa.classificacao.desfecho]} · {previa.minutos} minutos ÷ 60 · {previa.regras.valorHora} {previa.moeda}/hora</p>
        {previa.reservaAntecipada ? <p>Valor preservado da compra: {previa.valorApurado} {previa.moeda}. O valor contratual atual de {previa.valorContratualInformativo} {previa.moeda} é apenas informativo e não reprecifica as horas já quitadas.</p> : <p>Valor apurado: {previa.valorApurado} {previa.moeda}</p>}
        {previa.reservaAntecipada && <p>Reserva antecipada {previa.reservaAntecipada.reservaId}: {previa.reservaAntecipada.minutos} minutos da compra {previa.reservaAntecipada.compraId} serão consumidos por esta ocorrência. A compra preserva {previa.reservaAntecipada.valorPagoAlocado} {previa.reservaAntecipada.moeda} já alocados; nenhuma cobrança, recebimento ou crédito será criado.</p>}
        {previa.aditivo && <p>Fonte contratual: Aditivo versão {previa.aditivo.versao}.</p>}
        <p>Cláusula de preço: {previa.regras.clausulaPreco}</p><p>Cláusula de cancelamento: {previa.regras.clausulaCancelamento}</p>
        {previa.classificacao.limiteCancelamento && <p>Limite de cancelamento: {data(previa.classificacao.limiteCancelamento)} ({e.fusoOrigem})</p>}
        {previa.pendencias.map(p => <p key={p} role="status">{p}</p>)}
        {!previa.pendencias.length && <form onSubmit={event => {
          event.preventDefault(); const f = new FormData(event.currentTarget);
          iniciar(async () => {
            const entrada = { ...origem, estadoPrevia: previa.estadoPrevia, motivo: String(f.get("motivo")) }, serial = JSON.stringify(entrada);
            if (chave.current.entrada !== serial) chave.current = { entrada: serial, valor: crypto.randomUUID() };
            try { const r = await conferirOcorrenciaHoras({ ...entrada, chaveIdempotencia: chave.current.valor }); setMensagem(r.ok ? "Conferência registrada." : r.erro); if (r.ok) { setPrevia(null); router.refresh(); } }
            catch { setMensagem("Atualize o histórico para conferir o resultado antes de repetir."); }
          });
        }}><label className="block">Justificativa da conferência<textarea className="block w-full rounded border p-2" name="motivo" required minLength={5} maxLength={2000} disabled={ocupado} /></label>
          <button className="mt-2 rounded border p-2" disabled={ocupado}>Registrar conferência</button></form>}
      </section>}
    </>}
    {mensagem && <p role="status">{mensagem}</p>}
  </article>;
}
