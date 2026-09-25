"use client";
import { useRef } from "react";
import { Formulario } from "../../../recuperacoes/planos/[propostaId]/Formularios";
import { proporExtraRecuperacao, decidirExtraRecuperacao } from "@/server/avaliacoes/extra-recuperacao";
import type { HABILIDADES } from "@/server/avaliacoes/calculo";
import { executarAcaoCliente, type DesfechoAcao } from "@/lib/acao-cliente";
import { CampoTexto } from "@/components/CampoTexto";
type Habilidade = typeof HABILIDADES[number];
const texto = (d: FormData, campo: string) => String(d.get(campo) ?? "");
// O <Formulario> compartilhado guarda ocupado/erro e só entende { ok, erro }: executarAcaoCliente decide a
// mensagem de resultado incerto conforme a idempotência desta action, e o desfecho volta nesse formato.
const resposta = (d: DesfechoAcao<unknown>) => d.tipo === "ok" ? { ok: true as const } : { ok: false as const, erro: d.mensagem };

export function ProporExtra({ alocacaoId, habilidades }: { alocacaoId: string; habilidades: Habilidade[] }) {
  const chaves = useRef(new Map<string, string>());
  return <Formulario titulo="Solicitar oportunidades extras" executar={async d => {
    const entrada = { alocacaoId, habilidade: texto(d, "habilidade") as Habilidade, quantidade: Number(texto(d, "quantidade")), motivo: texto(d, "motivo"), evidencias: texto(d, "evidencias") };
    const assinatura = JSON.stringify(entrada);
    if (!chaves.current.has(assinatura)) chaves.current.set(assinatura, crypto.randomUUID());
    // Chave estável por entrada; o servidor devolve a proposta já criada com a mesma chave (server/avaliacoes/extra-recuperacao.ts:24-27).
    return resposta(await executarAcaoCliente(() => proporExtraRecuperacao({ ...entrada, chaveIdempotencia: chaves.current.get(assinatura)! }), { idempotente: true }));
  }}>
    <label className="block">Habilidade<select name="habilidade" required className="block rounded border p-2">{habilidades.map(h => <option key={h} value={h}>{h.replaceAll("_", " ")}</option>)}</select></label>
    <label className="block">Quantidade adicional<input type="number" name="quantidade" min={1} max={2147483647} step={1} required className="block rounded border p-2" /></label>
    <label className="block">Motivo<CampoTexto name="motivo" minLength={5} maxLength={2000} required className="block w-full rounded border p-2" /></label>
    <label className="block">Evidências para a análise<CampoTexto name="evidencias" minLength={5} maxLength={4000} required className="block w-full rounded border p-2" /></label>
  </Formulario>;
}

export function DecidirExtra({ propostaId, entradaHash, podeAprovar }: { propostaId: string; entradaHash: string; podeAprovar: boolean }) {
  // Decisão sem chave de idempotência no contrato (server/avaliacoes/extra-recuperacao.ts:42): a falha não manda reenviar.
  return <Formulario titulo="Registrar decisão" executar={async d => resposta(await executarAcaoCliente(() => decidirExtraRecuperacao({ propostaId, entradaHash, aprovada: texto(d, "decisao") === "aprovar", motivo: texto(d, "motivo") }), { idempotente: false }))}>
    <label className="block">Decisão<select name="decisao" required defaultValue="" className="block rounded border p-2"><option value="" disabled>Selecione</option>{podeAprovar && <option value="aprovar">Aprovar a quantidade proposta</option>}<option value="rejeitar">Rejeitar</option></select></label>
    <label className="block">Justificativa da decisão<CampoTexto name="motivo" required minLength={5} maxLength={2000} className="block w-full rounded border p-2" /></label>
  </Formulario>;
}
