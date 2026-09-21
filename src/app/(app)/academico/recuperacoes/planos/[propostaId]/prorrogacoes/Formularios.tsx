"use client";
import { useRef } from "react";
import { Formulario, Horario } from "../Formularios";
import { proporProrrogacaoRecuperacaoLocal } from "@/server/avaliacoes/recuperacao-operacao-local";
import { decidirProrrogacaoRecuperacao } from "@/server/avaliacoes/recuperacao-prorrogacao";
const campo = (d: FormData, nome: string) => String(d.get(nome) ?? "");

export function ProporProrrogacao({ disponibilizacaoId, prazoAnterior, versaoEsperada }: { disponibilizacaoId: string; prazoAnterior: string; versaoEsperada: number }) {
  const tentativa = useRef<{ entrada: string; chave: string } | null>(null);
  return <Formulario titulo="Propor prorrogação" executar={async d => {
    const dados = { disponibilizacaoId, prazoAnterior, versaoEsperada, dataHora: campo(d, "dataHora"), fuso: campo(d, "fuso"), motivo: campo(d, "motivo") }, entrada = JSON.stringify(dados);
    if (tentativa.current?.entrada !== entrada) tentativa.current = { entrada, chave: crypto.randomUUID() };
    const r = await proporProrrogacaoRecuperacaoLocal({ ...dados, chaveIdempotencia: tentativa.current.chave });
    if (r.ok) tentativa.current = null;
    return r;
  }}>
    <Horario rotulo="Novo prazo proposto" />
    <label className="block">Justificativa<textarea name="motivo" required minLength={5} maxLength={2000} className="block w-full rounded border p-2" /></label>
    <p>O prazo só muda após aprovação por outra pessoa da gestão. A proposta não concede nova tentativa.</p>
  </Formulario>;
}

export function ConferirProrrogacao({ propostaId, propostaHash, podeAprovar }: { propostaId: string; propostaHash: string; podeAprovar: boolean }) {
  return <Formulario titulo="Registrar decisão" executar={d => decidirProrrogacaoRecuperacao({ propostaId, propostaHash, aprovada: campo(d, "decisao") === "aprovar", motivo: campo(d, "motivo") })}>
    <label className="block">Decisão<select name="decisao" required defaultValue="" className="ml-2 rounded border p-2"><option value="" disabled>Selecione</option>{podeAprovar && <option value="aprovar">Aprovar prorrogação</option>}<option value="rejeitar">Rejeitar proposta</option></select></label>
    <label className="block">Motivo<textarea name="motivo" required minLength={5} maxLength={2000} className="block w-full rounded border p-2" /></label>
  </Formulario>;
}
