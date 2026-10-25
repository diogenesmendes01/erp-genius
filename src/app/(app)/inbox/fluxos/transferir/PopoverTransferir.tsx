"use client";
import { useEffect, useRef, useState, type RefObject } from "react";
import { Botao } from "@/components/Botao";
import { Campo } from "@/components/Campo";
import { CampoTexto } from "@/components/CampoTexto";
import { EstadoVazio } from "@/components/EstadoVazio";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { SETOR_ATENDIMENTO_LABEL, rotular } from "@/lib/labels";
import type { Setor } from "@/server/whatsapp/setor";
import type { OpcoesTransferir } from "./opcoes-transferir";
import type { DestinoTransferencia } from "../../AcoesAtendimento";
import { PopoverFluxo } from "../PopoverFluxo";
export type AlvoTransferir = { tipo: "pessoa"; usuarioId: string } | { tipo: "setor"; setor: Setor; destinoChave: string | null } | { tipo: "fila" } | { tipo: "aria" };
export interface EntradaConfirmacaoTransferir { alvo: AlvoTransferir; contexto: string }
export interface PropsPopoverTransferir {
  atendimentoId: string; ancora: RefObject<HTMLButtonElement | null>; opcoes: OpcoesTransferir;
  pessoas: { id: string; nome: string }[] | null; destinos: DestinoTransferencia[];
  ocupado?: boolean; erro?: string | null; aoFechar(): void;
  aoExecutar(entrada: EntradaConfirmacaoTransferir): void;
}
/** Apresentação apenas: autorização e ACK pertencem ao controlador da abertura. */
export function PopoverTransferir({ ancora, opcoes, pessoas, destinos, ocupado = false, erro, aoFechar, aoExecutar }: PropsPopoverTransferir) {
  const [passo, setPasso] = useState<"inicio" | "pessoas" | "equipes" | "aria">("inicio");
  const [pessoa, setPessoa] = useState("");
  const [equipe, setEquipe] = useState<Setor | "fila" | "">("");
  const [destinoChave, setDestinoChave] = useState("");
  const [contexto, setContexto] = useState("");
  const campoPessoa = useRef<HTMLSelectElement>(null);
  const campoEquipe = useRef<HTMLSelectElement>(null);
  const resumoAria = useRef<HTMLParagraphElement>(null);
  const cancelar = useRef<HTMLButtonElement>(null);
  const passoAnterior = useRef(passo);
  useEffect(() => {
    if (passoAnterior.current === passo) return;
    passoAnterior.current = passo;
    const alvo = passo === "pessoas" ? campoPessoa.current : passo === "equipes" ? campoEquipe.current : passo === "aria" ? resumoAria.current : cancelar.current;
    alvo?.focus();
  }, [passo]);
  if (!opcoes.visivel) return null;
  const exigeDestino = equipe === "FINANCEIRO" || equipe === "PEDAGOGICO";
  const destinosDisponiveis = destinos.filter(d => d.finalidade === equipe && d.disponivel !== false);
  const alvo: AlvoTransferir | null = passo === "aria" && opcoes.aria ? { tipo: "aria" }
    : passo === "pessoas" && opcoes.pessoas && pessoas?.some(p => p.id === pessoa) ? { tipo: "pessoa", usuarioId: pessoa }
    : passo === "equipes" && equipe === "fila" && opcoes.filaDoSetor ? { tipo: "fila" }
    : passo === "equipes" && equipe && equipe !== "fila" && opcoes.setores.includes(equipe) && (!exigeDestino || destinosDisponiveis.some(d => d.chave === destinoChave)) ? { tipo: "setor", setor: equipe, destinoChave: exigeDestino ? destinoChave : null } : null;
  const podeConfirmar = !!alvo && (alvo.tipo !== "setor" || contexto.trim().length >= 12);
  const mostraContexto = passo === "pessoas" || (passo === "equipes" && equipe !== "fila");
  return <PopoverFluxo titulo="Transferir" ancora={ancora} aoFechar={aoFechar} ocupado={ocupado}>
    <form onSubmit={e => { e.preventDefault(); if (!ocupado && podeConfirmar && alvo) aoExecutar({ alvo, contexto: contexto.trim() }); }} className="space-y-3">
      {passo === "inicio" ? <div className="grid gap-2">
        {opcoes.pessoas && <Botao variante="neutro" onClick={() => setPasso("pessoas")}>Pessoas</Botao>}
        {(opcoes.setores.length > 0 || opcoes.filaDoSetor) && <Botao variante="neutro" onClick={() => setPasso("equipes")}>Equipes e filas</Botao>}
        {opcoes.aria && <Botao variante="ia" onClick={() => setPasso("aria")}>Devolver para a Aria</Botao>}
      </div> : <>
        {passo === "pessoas" && <Campo rotulo="Pessoa" obrigatorio>{c => <select ref={campoPessoa} {...c} value={pessoa} disabled={ocupado || pessoas === null} onChange={e => setPessoa(e.target.value)} className="w-full rounded-md border border-gray-300 p-2"><option value="">{pessoas === null ? "Carregando…" : "Escolha…"}</option>{pessoas?.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}</select>}</Campo>}
        {passo === "pessoas" && pessoas?.length === 0 && <EstadoVazio>Ninguém disponível.</EstadoVazio>}
        {passo === "equipes" && <Campo rotulo="Equipe ou fila" obrigatorio>{c => <select ref={campoEquipe} {...c} value={equipe} disabled={ocupado} onChange={e => { setEquipe(e.target.value as Setor | "fila"); setDestinoChave(""); }} className="w-full rounded-md border border-gray-300 p-2"><option value="">Escolha…</option>{opcoes.filaDoSetor && <option value="fila">Fila de {rotular(SETOR_ATENDIMENTO_LABEL, opcoes.filaDoSetor)}</option>}{opcoes.setores.map(s => <option key={s} value={s}>{rotular(SETOR_ATENDIMENTO_LABEL, s)}</option>)}</select>}</Campo>}
        {passo === "equipes" && exigeDestino && <Campo rotulo="Contexto do destino" obrigatorio>{c => <select {...c} disabled={ocupado} value={destinoChave} onChange={e => setDestinoChave(e.target.value)} className="w-full rounded-md border border-gray-300 p-2"><option value="">Escolha…</option>{destinosDisponiveis.map(d => <option key={d.chave} value={d.chave}>{d.nome}</option>)}</select>}</Campo>}
        {mostraContexto && <Campo rotulo="Contexto da transferência" obrigatorio={alvo?.tipo === "setor"}>{c => <CampoTexto {...c} disabled={ocupado} rows={3} maxLength={1000} minLength={alvo?.tipo === "setor" ? 12 : undefined} value={contexto} onChange={e => setContexto(e.target.value)} className="w-full rounded-md border border-gray-300 p-2" />}</Campo>}
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
