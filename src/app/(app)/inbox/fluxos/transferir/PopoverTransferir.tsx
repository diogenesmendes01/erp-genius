"use client";
import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { Botao } from "@/components/Botao";
import { Campo, ROTULO_CAMPO } from "@/components/Campo";
import { CampoTexto } from "@/components/CampoTexto";
import { EstadoVazio } from "@/components/EstadoVazio";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { SETOR_ATENDIMENTO_LABEL, rotular } from "@/lib/labels";
import type { Setor } from "@/server/whatsapp/setor";
import type { StatusPresencaInbox } from "@/lib/presenca-inbox";
import type { OpcoesTransferir } from "./opcoes-transferir";
import type { DestinoTransferencia } from "../../AcoesAtendimento";
import { Combobox } from "@/components/ui/combobox";
import { garantirEstilo } from "@/app/(app)/inbox/garantir-estilo";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { PopoverFluxo } from "../PopoverFluxo";
export type AlvoTransferir = { tipo: "pessoa"; usuarioId: string } | { tipo: "setor"; setor: Setor; destinoChave: string | null } | { tipo: "fila" } | { tipo: "aria" };
export interface EntradaConfirmacaoTransferir { alvo: AlvoTransferir; contexto: string; anexarResumoAria?: boolean }
export interface PessoaTransferir { id:string; nome:string; carga?:number; presenca?:StatusPresencaInbox }
export interface PropsPopoverTransferir {
  atendimentoId: string; ancora: RefObject<HTMLButtonElement | null>; opcoes: OpcoesTransferir;
  pessoas: PessoaTransferir[] | null; destinos: DestinoTransferencia[];
  temResumoAria?: boolean; ocupado?: boolean; erro?: string | null; aoFechar(): void;
  aoExecutar(entrada: EntradaConfirmacaoTransferir): void;
}
export function PopoverTransferir({ ancora, opcoes, pessoas, destinos, temResumoAria = false, ocupado = false, erro, aoFechar, aoExecutar }: PropsPopoverTransferir) {
  garantirEstilo();
  const [passo, setPasso] = useState<"inicio" | "pessoas" | "equipes" | "aria">("inicio");
  const [pessoa, setPessoa] = useState("");
  const [equipe, setEquipe] = useState<Setor | "fila" | "">("");
  const [destinoChave, setDestinoChave] = useState("");
  const [contexto, setContexto] = useState("");
  const [preferenciaResumo, setPreferenciaResumo] = useState<boolean | null>(null);
  const anexarResumoAria = temResumoAria && (preferenciaResumo ?? true);
  const campoPessoa = useRef<HTMLButtonElement>(null);
  const grupoPessoas = useRef<HTMLFieldSetElement>(null);
  const nomeGrupoPessoa = useId();
  const carregavaPessoas = useRef(pessoas === null);
  const campoEquipe = useRef<HTMLDivElement>(null);
  const resumoAria = useRef<HTMLParagraphElement>(null);
  const cancelar = useRef<HTMLButtonElement>(null);
  const passoAnterior = useRef(passo);
  useEffect(() => {
    const mudouPasso=passoAnterior.current!==passo;
    const chegaramPessoas=carregavaPessoas.current&&pessoas!==null;
    passoAnterior.current=passo;carregavaPessoas.current=pessoas===null;
    if(!mudouPasso&&!(passo==="pessoas"&&chegaramPessoas))return;
    const alvo=passo==="pessoas"?(campoPessoa.current??grupoPessoas.current):passo==="equipes"?campoEquipe.current:passo==="aria"?resumoAria.current:cancelar.current;
    alvo?.focus();
  },[passo,pessoas]);
  if (!opcoes.visivel) return null;
  const exigeDestino = equipe === "FINANCEIRO" || equipe === "PEDAGOGICO";
  const destinosDisponiveis = destinos.filter(d => d.finalidade === equipe && d.disponivel !== false);
  const alvo: AlvoTransferir | null = passo === "aria" && opcoes.aria ? { tipo: "aria" }
    : passo === "pessoas" && opcoes.pessoas && pessoas?.some(p => p.id === pessoa) ? { tipo: "pessoa", usuarioId: pessoa }
    : passo === "equipes" && equipe === "fila" && opcoes.filaDoSetor ? { tipo: "fila" }
    : passo === "equipes" && equipe && equipe !== "fila" && opcoes.setores.includes(equipe) && (!exigeDestino || destinosDisponiveis.some(d => d.chave === destinoChave)) ? { tipo: "setor", setor: equipe, destinoChave: exigeDestino ? destinoChave : null } : null;
  const podeConfirmar = !!alvo && contexto.trim().length <= 1000;
  const mostraContexto = passo === "pessoas" || (passo === "equipes" && equipe !== "fila");
  return <PopoverFluxo titulo="Transferir" ancora={ancora} aoFechar={aoFechar} ocupado={ocupado}>
    <form onSubmit={e => { e.preventDefault(); if (!ocupado && podeConfirmar && alvo) aoExecutar({ alvo, contexto: contexto.trim(), ...(alvo.tipo === "setor" || (alvo.tipo === "pessoa" && temResumoAria) ? { anexarResumoAria } : {}) }); }} className="space-y-3">
      {passo === "inicio" ? <div className="grid gap-2">
        {opcoes.pessoas && <Botao variante="neutro" onClick={() => setPasso("pessoas")}>Pessoas</Botao>}
        {(opcoes.setores.length > 0 || opcoes.filaDoSetor) && <Botao variante="neutro" onClick={() => setPasso("equipes")}>Equipes e filas</Botao>}
        {opcoes.aria && <Botao variante="ia" onClick={() => setPasso("aria")}>Devolver para a Aria</Botao>}
      </div> : <>
        {passo === "pessoas" && <fieldset ref={grupoPessoas} tabIndex={-1} disabled={ocupado || pessoas === null} aria-busy={pessoas === null || undefined} className="min-w-0">
          <legend className={ROTULO_CAMPO}>Pessoa <span aria-hidden="true">*</span></legend>
          {pessoas === null ? <p className="text-sm text-gray-600" role="status">Carregando pessoas…</p> : <RadioGroup name={nomeGrupoPessoa} value={pessoa} required disabled={ocupado} onValueChange={(valor) => { if (!ocupado) setPessoa(valor); }} className="max-h-56 space-y-2 overflow-y-auto overscroll-contain">
            {pessoas.map((p,i)=><label key={p.id} className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 bg-surface p-3">
              <RadioGroupItem ref={pessoa===p.id||(!pessoa&&i===0)?campoPessoa:undefined} value={p.id} required disabled={ocupado} />
              <span className="min-w-0"><span className="block break-words text-sm font-medium text-gray-800">{p.nome}</span><span className="block text-xs text-gray-500">{p.carga===undefined?"Carga indisponível":`${p.carga} ${p.carga===1?"conversa aberta":"conversas abertas"} neste setor`} · {p.presenca === "online" ? "Online" : p.presenca === "ausente" ? "Ausente" : p.presenca === "offline" ? "Offline" : "Presença indisponível"}</span></span>
            </label>)}
          </RadioGroup>}
        </fieldset>}
        {passo === "pessoas" && pessoas?.length === 0 && <EstadoVazio>Ninguém disponível.</EstadoVazio>}
        {passo === "equipes" && <Campo rotulo="Equipe ou fila" obrigatorio>{c => <div ref={campoEquipe} tabIndex={-1}><Combobox id={c.id} aria-label="Equipe ou fila" value={equipe} disabled={ocupado} vazio="Escolha…" onValueChange={(valor) => { setEquipe(valor as Setor | "fila"); setDestinoChave(""); }} opcoes={[...(opcoes.filaDoSetor ? [{ valor: "fila", rotulo: `Fila de ${rotular(SETOR_ATENDIMENTO_LABEL, opcoes.filaDoSetor)}` }] : []), ...opcoes.setores.map(s => ({ valor: s, rotulo: rotular(SETOR_ATENDIMENTO_LABEL, s) }))]} /></div>}</Campo>}
        {passo === "equipes" && exigeDestino && <Campo rotulo="Contexto do destino" obrigatorio>{c => <Combobox id={c.id} aria-label="Contexto do destino" value={destinoChave} disabled={ocupado} vazio="Escolha…" onValueChange={setDestinoChave} opcoes={destinosDisponiveis.map(d => ({ valor: d.chave, rotulo: d.nome }))} />}</Campo>}
        {mostraContexto && <Campo rotulo="Contexto da transferência" dica="Opcional">{c => <CampoTexto {...c} disabled={ocupado} rows={3} maxLength={1000} value={contexto} onChange={e => setContexto(e.target.value)} className="w-full rounded-md border border-gray-200 p-2" />}</Campo>}
        {(passo === "pessoas" || (passo === "equipes" && equipe !== "" && equipe !== "fila")) && temResumoAria && <label className="flex items-start gap-2 text-sm"><Checkbox checked={anexarResumoAria} disabled={ocupado} onCheckedChange={(valor) => setPreferenciaResumo(valor === true)} />Anexar resumo da Aria como nota</label>}
        {passo === "aria" && <p ref={resumoAria} tabIndex={-1} className="text-sm text-gray-600">A Aria retoma este atendimento pelas regras atuais.</p>}
      </>}
      <FeedbackAcao erro={erro} />
      <div className="flex justify-end gap-2">
        <Botao ref={cancelar} variante="secundario" disabled={ocupado} onClick={aoFechar}>Cancelar</Botao>
        {passo !== "inicio" && <Botao variante="neutro" disabled={ocupado} onClick={() => setPasso("inicio")}>Voltar</Botao>}
        {passo !== "inicio" && <Botao type="submit" disabled={!podeConfirmar} ocupado={ocupado}>Transferir</Botao>}
      </div>
    </form>
  </PopoverFluxo>;
}
