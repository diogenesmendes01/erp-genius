"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { decidirRegraAvaliacao, prepararRegraAvaliacao } from "@/server/avaliacoes/regras";
import { nomesHabilidades, type ConteudoRegra } from "./ResumoRegra";
import { botaoClasses } from "@/components/Botao";
import { MSG_DECISAO_INCERTA, MSG_RESULTADO_INCERTO } from "@/lib/mensagens";
import { CampoTexto } from "@/components/CampoTexto";

const habilidades = Object.keys(nomesHabilidades) as (keyof typeof nomesHabilidades)[];
const campo = "block w-full rounded border p-2";

export function ProporRegra({ nivelId, versaoEsperada, inicial }: { nivelId: string; versaoEsperada: number; inicial?: ConteudoRegra }) {
  const router = useRouter();
  const [quantidade, setQuantidade] = useState(inicial?.avaliacoes.length ?? 2);
  const [ocupado, setOcupado] = useState(false), [erro, setErro] = useState("");
  const chave = useRef<string | null>(null);
  function mudou() { chave.current = null; setErro(""); }
  return <form className="space-y-4" onChange={mudou} onSubmit={async e => {
    e.preventDefault(); const f = new FormData(e.currentTarget);
    const texto = (n: string) => String(f.get(n) ?? "").trim();
    const decimal = (n: string) => texto(n).replace(",", ".");
    const numero = (n: string) => texto(n) === "" ? NaN : Number(texto(n));
    const conteudo: ConteudoRegra = {
      titulo: texto("titulo"), aplicacao: texto("aplicacao"), escala: { minimo: decimal("escalaMin"), maximo: decimal("escalaMax") }, minimoGeral: decimal("minimoGeral"), frequenciaMinimaPercentual: decimal("frequencia"),
      habilidades: habilidades.map(habilidade => ({ habilidade, peso: decimal(`${habilidade}-peso`), minimo: decimal(`${habilidade}-minimo`), limiteRecuperacoes: numero(`${habilidade}-limite`) })),
      avaliacoes: Array.from({ length: quantidade }, (_, i) => ({ codigo: texto(`a${i}-codigo`), titulo: texto(`a${i}-titulo`), etapa: texto(`a${i}-etapa`) as "FINAL" | "INTERMEDIARIA", peso: decimal(`a${i}-peso`),
        habilidades: habilidades.filter(h => f.has(`a${i}-${h}`)), limiteSegundasChamadas: numero(`a${i}-limite`) })),
      recuperacao: { prazoRealizacaoMinutos: numero("rec-prazo"), antecedenciaCancelamentoMinutos: numero("rec-antecedencia") },
      segundaChamada: { prazoRealizacaoMinutos: numero("seg-prazo"), antecedenciaCancelamentoMinutos: numero("seg-antecedencia") },
    };
    chave.current ??= crypto.randomUUID(); setOcupado(true); setErro("");
    try {
      const r = await prepararRegraAvaliacao({ nivelId, versaoEsperada, conteudo, motivo: texto("motivo"), chaveIdempotencia: chave.current });
      if (!r.ok) setErro(r.erro); else router.refresh();
    } catch { setErro(MSG_RESULTADO_INCERTO); }
    finally { setOcupado(false); }
  }}>
    <fieldset disabled={ocupado} className="space-y-4">
      <legend className="text-lg font-medium">Preparar versão {versaoEsperada + 1}</legend>
      <p>Preencha todos os parâmetros. Outra pessoa da Gestão Pedagógica/Administração precisará conferir e publicar.</p>
      <label className="block">Título<input className={campo} name="titulo" required minLength={3} maxLength={200} defaultValue={inicial?.titulo} /></label>
      <label className="block">Condições de aplicação<CampoTexto className={campo} name="aplicacao" required minLength={5} maxLength={2000} defaultValue={inicial?.aplicacao} /></label>
      <div className="grid gap-3 sm:grid-cols-2">
        {[{ nome: "escalaMin", titulo: "Menor nota da escala", valor: inicial?.escala.minimo }, { nome: "escalaMax", titulo: "Maior nota da escala", valor: inicial?.escala.maximo }, { nome: "minimoGeral", titulo: "Mínimo da média geral", valor: inicial?.minimoGeral }, { nome: "frequencia", titulo: "Frequência mínima (%)", valor: inicial?.frequenciaMinimaPercentual }].map(c => <label key={c.nome}>{c.titulo}<input className={campo} name={c.nome} required maxLength={100} inputMode="decimal" defaultValue={c.valor} /></label>)}
      </div>
      {habilidades.map(h => { const c = inicial?.habilidades.find(c => c.habilidade === h); return <fieldset key={h} className="grid gap-3 rounded border p-3 sm:grid-cols-3"><legend>{nomesHabilidades[h]}</legend>
        <label>Peso na média geral<input className={campo} name={`${h}-peso`} required inputMode="decimal" maxLength={100} defaultValue={c?.peso} /></label>
        <label>Nota mínima<input className={campo} name={`${h}-minimo`} required inputMode="decimal" maxLength={100} defaultValue={c?.minimo} /></label>
        <label>Limite de recuperações<input className={campo} name={`${h}-limite`} type="number" min={0} max={2147483647} step={1} required defaultValue={c?.limiteRecuperacoes} /></label>
      </fieldset>; })}
      <p>As intermediárias podem selecionar habilidades. A etapa final precisa cobrir as quatro, em um ou mais instrumentos.</p>
      {Array.from({ length: quantidade }, (_, i) => { const a = inicial?.avaliacoes[i]; return <fieldset key={i} className="space-y-3 rounded border p-3"><legend>Avaliação {i + 1}</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <label>Código<input className={campo} name={`a${i}-codigo`} required maxLength={100} defaultValue={a?.codigo} /></label>
          <label>Título<input className={campo} name={`a${i}-titulo`} required minLength={3} maxLength={200} defaultValue={a?.titulo} /></label>
          <label>Etapa<select className={campo} name={`a${i}-etapa`} required defaultValue={a?.etapa ?? ""}><option value="">Selecione</option><option value="INTERMEDIARIA">Intermediária</option><option value="FINAL">Final</option></select></label>
          <label>Peso da avaliação<input className={campo} name={`a${i}-peso`} required maxLength={100} inputMode="decimal" defaultValue={a?.peso} /></label>
          <label>Limite de segundas chamadas<input className={campo} name={`a${i}-limite`} type="number" required min={0} max={2147483647} step={1} defaultValue={a?.limiteSegundasChamadas} /></label>
        </div>
        <div className="flex flex-wrap gap-4">{habilidades.map(h => <label key={h}><input type="checkbox" name={`a${i}-${h}`} defaultChecked={a?.habilidades.includes(h)} /> {nomesHabilidades[h]}</label>)}</div>
      </fieldset>; })}
      <div className="flex gap-3"><button type="button" className={botaoClasses({ variante: "secundario", tamanho: "lg" })} disabled={quantidade >= 1000} onClick={() => { mudou(); setQuantidade(q => q + 1); }}>Adicionar avaliação</button><button type="button" className={botaoClasses({ variante: "secundario", tamanho: "lg" })} disabled={quantidade <= 2} onClick={() => { mudou(); setQuantidade(q => q - 1); }}>Remover última avaliação</button></div>
      {[{ chave: "rec", titulo: "Recuperação", valor: inicial?.recuperacao }, { chave: "seg", titulo: "Segunda chamada", valor: inicial?.segundaChamada }].map(c => <fieldset key={c.chave} className="grid gap-3 rounded border p-3 sm:grid-cols-2"><legend>{c.titulo}</legend>
        <label>Prazo desde a disponibilização (minutos)<input className={campo} name={`${c.chave}-prazo`} type="number" min={1} max={2147483647} step={1} required defaultValue={c.valor?.prazoRealizacaoMinutos} /></label>
        <label>Antecedência para cancelamento (minutos)<input className={campo} name={`${c.chave}-antecedencia`} type="number" min={0} max={2147483647} step={1} required defaultValue={c.valor?.antecedenciaCancelamentoMinutos} /></label>
      </fieldset>)}
      <label className="block">Motivo da proposta<CampoTexto className={campo} name="motivo" required minLength={5} maxLength={2000} /></label>
      <button className={botaoClasses({ tamanho: "lg" })} disabled={ocupado}>{ocupado ? "Salvando…" : "Enviar proposta para conferência"}</button>
    </fieldset>
    {erro && <p role="alert" className="text-red-700">{erro}</p>}
  </form>;
}

export function DecidirRegra({ regraId, conteudoHash, podeAprovar }: { regraId: string; conteudoHash: string; podeAprovar: boolean }) {
  const router = useRouter(); const [ocupado, setOcupado] = useState(false), [erro, setErro] = useState("");
  return <form onSubmit={async e => {
    e.preventDefault(); const f = new FormData(e.currentTarget); setOcupado(true); setErro("");
    try {
      const r = await decidirRegraAvaliacao({ regraId, conteudoHash, aprovada: f.get("decisao") === "aprovar", motivo: String(f.get("motivo") ?? "") });
      if (!r.ok) setErro(r.erro); else router.refresh();
    } catch { setErro(MSG_DECISAO_INCERTA); }
    finally { setOcupado(false); }
  }} className="space-y-3">
    <fieldset disabled={ocupado} className="space-y-3"><legend className="font-medium">Decisão sobre esta versão</legend>
      <label className="block">Decisão<select className={campo} name="decisao" required defaultValue=""><option value="">Selecione</option>{podeAprovar && <option value="aprovar">Aprovar e publicar</option>}<option value="rejeitar">Rejeitar para revisão</option></select></label>
      {!podeAprovar && <p>Existe proposta mais recente; esta versão pode ser rejeitada, mas não publicada.</p>}
      <label className="block">Justificativa<CampoTexto className={campo} name="motivo" required minLength={5} maxLength={2000} /></label>
      <label className="block"><input type="checkbox" required /> Conferi todos os critérios desta versão.</label>
      <button className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>{ocupado ? "Registrando…" : "Registrar decisão"}</button>
    </fieldset>{erro && <p role="alert" className="text-red-700">{erro}</p>}
  </form>;
}
