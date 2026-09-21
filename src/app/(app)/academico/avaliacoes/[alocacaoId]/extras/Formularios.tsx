"use client";
import { useRef } from "react";
import { Formulario } from "../../../recuperacoes/planos/[propostaId]/Formularios";
import { proporExtraRecuperacao, decidirExtraRecuperacao } from "@/server/avaliacoes/extra-recuperacao";
import type { HABILIDADES } from "@/server/avaliacoes/calculo";
type Habilidade = typeof HABILIDADES[number];
const texto = (d: FormData, campo: string) => String(d.get(campo) ?? "");

export function ProporExtra({ alocacaoId, habilidades }: { alocacaoId: string; habilidades: Habilidade[] }) {
  const chaves = useRef(new Map<string, string>());
  return <Formulario titulo="Solicitar oportunidades extras" executar={d => {
    const entrada = { alocacaoId, habilidade: texto(d, "habilidade") as Habilidade, quantidade: Number(texto(d, "quantidade")), motivo: texto(d, "motivo"), evidencias: texto(d, "evidencias") };
    const assinatura = JSON.stringify(entrada);
    if (!chaves.current.has(assinatura)) chaves.current.set(assinatura, crypto.randomUUID());
    return proporExtraRecuperacao({ ...entrada, chaveIdempotencia: chaves.current.get(assinatura)! });
  }}>
    <label className="block">Habilidade<select name="habilidade" required className="block rounded border p-2">{habilidades.map(h => <option key={h} value={h}>{h.replaceAll("_", " ")}</option>)}</select></label>
    <label className="block">Quantidade adicional<input type="number" name="quantidade" min={1} max={2147483647} step={1} required className="block rounded border p-2" /></label>
    <label className="block">Motivo<textarea name="motivo" minLength={5} maxLength={2000} required className="block w-full rounded border p-2" /></label>
    <label className="block">Evidências para a análise<textarea name="evidencias" minLength={5} maxLength={4000} required className="block w-full rounded border p-2" /></label>
  </Formulario>;
}

export function DecidirExtra({ propostaId, entradaHash, podeAprovar }: { propostaId: string; entradaHash: string; podeAprovar: boolean }) {
  return <Formulario titulo="Registrar decisão" executar={d => decidirExtraRecuperacao({ propostaId, entradaHash, aprovada: texto(d, "decisao") === "aprovar", motivo: texto(d, "motivo") })}>
    <label className="block">Decisão<select name="decisao" required defaultValue="" className="block rounded border p-2"><option value="" disabled>Selecione</option>{podeAprovar && <option value="aprovar">Aprovar a quantidade proposta</option>}<option value="rejeitar">Rejeitar</option></select></label>
    <label className="block">Justificativa da decisão<textarea name="motivo" required minLength={5} maxLength={2000} className="block w-full rounded border p-2" /></label>
  </Formulario>;
}
