"use client";
import { useRef } from "react";
import { Formulario, Horario } from "../Formularios";
import { proporProrrogacaoRecuperacaoLocal } from "@/server/avaliacoes/recuperacao-operacao-local";
import { decidirProrrogacaoRecuperacao } from "@/server/avaliacoes/recuperacao-prorrogacao";
import { executarAcaoCliente, type DesfechoAcao } from "@/lib/acao-cliente";
import { CampoTexto } from "@/components/CampoTexto";
const campo = (d: FormData, nome: string) => String(d.get(nome) ?? "");
// O <Formulario> compartilhado guarda ocupado/erro e só entende { ok, erro }: executarAcaoCliente decide a
// mensagem de resultado incerto conforme a idempotência desta action, e o desfecho volta nesse formato.
const resposta = (d: DesfechoAcao<unknown>) => d.tipo === "ok" ? { ok: true as const } : { ok: false as const, erro: d.mensagem };

export function ProporProrrogacao({ disponibilizacaoId, prazoAnterior, versaoEsperada, fusoInstitucional }: { disponibilizacaoId: string; prazoAnterior: string; versaoEsperada: number; fusoInstitucional: string | null }) {
  const tentativa = useRef<{ entrada: string; chave: string } | null>(null);
  return <Formulario titulo="Propor prorrogação" executar={async d => {
    const dados = { disponibilizacaoId, prazoAnterior, versaoEsperada, dataHora: campo(d, "dataHora"), fuso: campo(d, "fuso"), motivo: campo(d, "motivo") }, entrada = JSON.stringify(dados);
    if (tentativa.current?.entrada !== entrada) tentativa.current = { entrada, chave: crypto.randomUUID() };
    const chaveIdempotencia = tentativa.current.chave;
    // Chave estável por entrada; o servidor devolve a proposta já criada com a mesma chave (server/avaliacoes/recuperacao-prorrogacao.ts:25-28).
    const r = await executarAcaoCliente(() => proporProrrogacaoRecuperacaoLocal({ ...dados, chaveIdempotencia }), { idempotente: true });
    if (r.tipo === "ok") tentativa.current = null;
    return resposta(r);
  }}>
    <Horario rotulo="Novo prazo proposto" fusoInstitucional={fusoInstitucional} />
    <label className="block">Justificativa<CampoTexto name="motivo" required minLength={5} maxLength={2000} className="block w-full rounded border p-2" /></label>
    <p>O prazo só muda após aprovação por outra pessoa da gestão. A proposta não concede nova tentativa.</p>
  </Formulario>;
}

export function ConferirProrrogacao({ propostaId, propostaHash, podeAprovar }: { propostaId: string; propostaHash: string; podeAprovar: boolean }) {
  // Decisão sem chave de idempotência no contrato (server/avaliacoes/recuperacao-prorrogacao.ts:43): a falha não manda reenviar.
  return <Formulario titulo="Registrar decisão" executar={async d => resposta(await executarAcaoCliente(() => decidirProrrogacaoRecuperacao({ propostaId, propostaHash, aprovada: campo(d, "decisao") === "aprovar", motivo: campo(d, "motivo") }), { idempotente: false }))}>
    <label className="block">Decisão<select name="decisao" required defaultValue="" className="ml-2 rounded border p-2"><option value="" disabled>Selecione</option>{podeAprovar && <option value="aprovar">Aprovar prorrogação</option>}<option value="rejeitar">Rejeitar proposta</option></select></label>
    <label className="block">Motivo<CampoTexto name="motivo" required minLength={5} maxLength={2000} className="block w-full rounded border p-2" /></label>
  </Formulario>;
}
