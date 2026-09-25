"use client";
import { OrigemCampo, ROTULOS_ORIGEM } from "@/server/contratos/campos";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { ConteudoModeloSchema } from "@/server/contratos/modelo-schema";
import { prepararModeloContratual } from "@/server/contratos/modelos";

type Conteudo = z.infer<typeof ConteudoModeloSchema>;
import { PAPEIS_MODELO, CONDICOES_MODELO } from "./labels";
import { botaoClasses } from "@/components/Botao";
import { MSG_RESULTADO_INCERTO } from "@/lib/mensagens";
import { CampoTexto } from "@/components/CampoTexto";
const campo = "block w-full rounded border p-2";
const vazio: Conteudo = { titulo: "", finalidade: "CONTRATO", regimes: [], aplicacao: "", campos: [], secoes: [{ titulo: "", texto: "" }], assinaturas: [] };
export function ModeloFormulario({ codigo, versaoEsperada, inicial }: { codigo?: string; versaoEsperada: number; inicial?: Conteudo }) {
  const router = useRouter(), [valor, setValor] = useState<Conteudo>(inicial ?? vazio), [erro, setErro] = useState(""), [ocupado, setOcupado] = useState(false);
  const tentativa = useRef<{ entrada: string; chave: string } | null>(null);
  return <form className="space-y-5" onSubmit={async (e) => {
    e.preventDefault(); const f = new FormData(e.currentTarget);
    const conteudo = ConteudoModeloSchema.safeParse(valor);
    if (!conteudo.success) { setErro(conteudo.error.issues[0]?.message ?? "Confira o conteúdo."); return; }
    const d = { codigo: codigo ?? String(f.get("codigo") ?? "").trim().toUpperCase(), versaoEsperada, conteudo: conteudo.data, motivo: String(f.get("motivo") ?? "") };
    const entrada = JSON.stringify(d);
    if (tentativa.current && tentativa.current.entrada !== entrada) { setErro("A tentativa anterior ainda não foi confirmada. Consulte o histórico ou reenvie os mesmos dados antes de alterar a proposta."); return; }
    tentativa.current ??= { entrada, chave: crypto.randomUUID() }; setOcupado(true); setErro("");
    try {
      const r = await prepararModeloContratual({ ...d, chaveIdempotencia: tentativa.current.chave });
      if (!r.ok) { setErro(r.erro); if (r.erro !== "Erro inesperado. Tente novamente.") tentativa.current = null; }
      else { router.push(`/configuracao/contratos/${d.codigo}`); router.refresh(); }
    } catch { setErro(MSG_RESULTADO_INCERTO); }
    finally { setOcupado(false); }
  }}>
    <p>O conteúdo será enviado para aprovação de outra pessoa da Administração. Use as cláusulas e condições definidas pela escola.</p>
    <fieldset disabled={ocupado} className="space-y-5">
      <legend className="font-medium">Proposta de versão {versaoEsperada + 1}</legend>
      {codigo ? <p>Modelo: {codigo}</p> : <label className="block">Código do modelo<input name="codigo" required pattern="[A-Za-z][A-Za-z0-9_-]{1,59}" maxLength={60} className={campo} /><small>Identificação curta, com letras, números, hífen ou sublinhado.</small></label>}
      <label className="block">Título<input required maxLength={200} value={valor.titulo} onChange={(e) => setValor({ ...valor, titulo: e.target.value })} className={campo} /></label>
      <label className="block">Finalidade<select className={campo} value={valor.finalidade} onChange={(e) => setValor({ ...valor, finalidade: e.target.value as Conteudo["finalidade"] })}><option value="CONTRATO">Contrato</option><option value="ADITIVO">Aditivo</option></select></label>
      <fieldset><legend>Regimes atendidos</legend>{(["MENSALIDADE", "HORA_PARTICULAR"] as const).map((r) => <label key={r} className="mr-5"><input type="checkbox" checked={valor.regimes.includes(r)} onChange={(e) => setValor({ ...valor, regimes: e.target.checked ? [...valor.regimes, r] : valor.regimes.filter((v) => v !== r) })} /> {r === "MENSALIDADE" ? "Mensalidade" : "Particular por hora"}</label>)}</fieldset>
      <label className="block">Quando usar este modelo<CampoTexto required minLength={5} maxLength={4000} value={valor.aplicacao} onChange={(e) => setValor({ ...valor, aplicacao: e.target.value })} className={campo} /><small>Descreva as condições e os casos em que a equipe deve aplicar o modelo.</small></label>
      <fieldset className="space-y-3"><legend className="font-medium">Campos a preencher no documento</legend>
        <p>Declare os campos variáveis. Nas seções, use a chave entre duas chaves, por exemplo: {"{{aluno_nome}}"}.</p>
        {valor.campos.map((c, i) => <div className="grid gap-2 rounded border p-3 sm:grid-cols-3" key={i}>
          <label>Chave<input required pattern="[a-z][a-z0-9_]{0,59}" maxLength={60} value={c.chave} onChange={(e) => setValor({ ...valor, campos: valor.campos.map((v, j) => j === i ? { ...v, chave: e.target.value } : v) })} className={campo} /></label>
          <label>Descrição<input required maxLength={500} value={c.descricao} onChange={(e) => setValor({ ...valor, campos: valor.campos.map((v, j) => j === i ? { ...v, descricao: e.target.value } : v) })} className={campo} /></label>
          <label>Origem do preenchimento<select value={c.origem ?? ""} onChange={(e) => setValor({ ...valor, campos: valor.campos.map((v, j) => j === i ? { ...v, origem: (e.target.value || undefined) as OrigemCampo | undefined } : v) })} className={campo}><option value="">Pendente de definição</option>{Object.entries(ROTULOS_ORIGEM).map(([v, nome]) => <option key={v} value={v}>{nome}</option>)}</select></label>
          <button className={botaoClasses({ variante: "secundario", tamanho: "sm" })} type="button" onClick={() => setValor({ ...valor, campos: valor.campos.filter((_, j) => j !== i) })}>Remover campo {i + 1}</button>
        </div>)}
        <button type="button" disabled={valor.campos.length >= 100} className={botaoClasses({ variante: "secundario", tamanho: "sm" })} onClick={() => setValor({ ...valor, campos: [...valor.campos, { chave: "", descricao: "" }] })}>Adicionar campo</button>
      </fieldset>
      <fieldset className="space-y-3"><legend className="font-medium">Seções do documento</legend>
        {valor.secoes.map((s, i) => <div key={i} className="space-y-2 rounded border p-3">
          <label className="block">Título da seção {i + 1}<input required maxLength={200} value={s.titulo} onChange={(e) => setValor({ ...valor, secoes: valor.secoes.map((v, j) => j === i ? { ...v, titulo: e.target.value } : v) })} className={campo} /></label>
          <label className="block">Texto<textarea required rows={6} maxLength={20000} value={s.texto} onChange={(e) => setValor({ ...valor, secoes: valor.secoes.map((v, j) => j === i ? { ...v, texto: e.target.value } : v) })} className={campo} /></label>
          <button className={botaoClasses({ variante: "secundario", tamanho: "sm" })} type="button" disabled={valor.secoes.length === 1} onClick={() => setValor({ ...valor, secoes: valor.secoes.filter((_, j) => j !== i) })}>Remover seção {i + 1}</button>
        </div>)}
        <button type="button" disabled={valor.secoes.length >= 100} className={botaoClasses({ variante: "secundario", tamanho: "sm" })} onClick={() => setValor({ ...valor, secoes: [...valor.secoes, { titulo: "", texto: "" }] })}>Adicionar seção</button>
      </fieldset>
      <fieldset className="space-y-3"><legend className="font-medium">Assinaturas exigidas</legend>
        {valor.assinaturas.map((a, i) => <div key={i} className="grid gap-2 rounded border p-3 sm:grid-cols-3">
          <label>Papel<select className={campo} value={a.papel} onChange={(e) => setValor({ ...valor, assinaturas: valor.assinaturas.map((v, j) => j === i ? { ...v, papel: e.target.value as typeof a.papel } : v) })}>{Object.entries(PAPEIS_MODELO).map(([v, nome]) => <option key={v} value={v}>{nome}</option>)}</select></label>
          <label>Quando exigir<select className={campo} value={a.condicao} onChange={(e) => setValor({ ...valor, assinaturas: valor.assinaturas.map((v, j) => j === i ? { ...v, condicao: e.target.value as typeof a.condicao } : v) })}>{Object.entries(CONDICOES_MODELO).map(([v, nome]) => <option key={v} value={v}>{nome}</option>)}</select></label>
          <button className={botaoClasses({ variante: "secundario", tamanho: "sm" })} type="button" onClick={() => setValor({ ...valor, assinaturas: valor.assinaturas.filter((_, j) => j !== i) })}>Remover regra {i + 1}</button>
        </div>)}
        <button type="button" disabled={valor.assinaturas.length >= 20} className={botaoClasses({ variante: "secundario", tamanho: "sm" })} onClick={() => setValor({ ...valor, assinaturas: [...valor.assinaturas, { papel: "ALUNO", condicao: "SEMPRE" }] })}>Adicionar regra de assinatura</button>
      </fieldset>
      <label className="block">Motivo da proposta<CampoTexto name="motivo" required minLength={5} maxLength={2000} className={campo} /></label>
      <button type="submit" className={botaoClasses({ tamanho: "lg" })}>{ocupado ? "Salvando proposta…" : "Salvar proposta para aprovação"}</button>
    </fieldset>
    {erro && <p role="alert">{erro}</p>}
  </form>;
}
