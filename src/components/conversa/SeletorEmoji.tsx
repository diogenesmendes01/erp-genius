"use client";

import { useMemo, useState } from "react";
import { Botao } from "@/components/Botao";
import { EstadoVazio } from "@/components/EstadoVazio";
import emojiDados from "./emoji-dados.json";
import { AVISO_RECURSO_MOTOR } from "./recursos-canal";

export interface EntradaEmoji { emoji: string; label: string; keywords?: string; group: string; subgroup?: string }

const GRUPOS: Record<string, [string, string]> = {
  "Smileys & Emotion": ["Carinhas e emoções", "😀"],
  "People & Body": ["Pessoas e corpo", "👋"],
  "Animals & Nature": ["Animais e natureza", "🐻"],
  "Food & Drink": ["Comida e bebida", "🍔"],
  "Travel & Places": ["Viagens e lugares", "🚗"],
  Activities: ["Atividades", "⚽"],
  Objects: ["Objetos", "💡"],
  Symbols: ["Símbolos", "🔣"],
  Flags: ["Bandeiras", "🏁"],
};
const LIMITE_INICIAL = 160;
const CHAVE_RECENTES = "conversa-emoji-recentes";
const TOM_PELE = /[\u{1f3fb}-\u{1f3ff}]/u;

const normal = (v: string) => v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Busca por termos (sem acento) no rótulo e nas palavras-chave; variantes de tom de pele ficam de fora. */
export function buscarEmoji(dados: EntradaEmoji[], consulta: string, grupo: string): EntradaEmoji[] {
  const termos = normal(consulta).split(/\s+/).filter(Boolean);
  return dados.filter((e) => !TOM_PELE.test(e.emoji)
    && (termos.length > 0 || e.group === grupo)
    && termos.every((t) => normal(`${e.label} ${e.keywords ?? ""}`).includes(t)));
}

function lerRecentes(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE_RECENTES) ?? "[]") as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, 40) : [];
  } catch { return []; }
}
function gravarRecentes(v: string[]) { try { localStorage.setItem(CHAVE_RECENTES, JSON.stringify(v)); } catch { /* sem armazenamento: segue sem recentes */ } }

/** `gif`/`figurinha`: o canal executa o recurso (quem compõe decide com `capacidades` da thread); sem ele, a aba fica desabilitada com aviso. */
export function SeletorEmoji({ gif, figurinha, aoEmoji, aoFechar }: { gif: boolean; figurinha: boolean; aoEmoji: (e: string) => void; aoFechar: () => void }) {
  const [consulta, setConsulta] = useState("");
  const [grupo, setGrupo] = useState("Smileys & Emotion");
  const [limite, setLimite] = useState(LIMITE_INICIAL);
  const [recentes, setRecentes] = useState<string[]>(lerRecentes);
  const lista = useMemo(() => {
    if (!consulta.trim() && grupo === "recentes") {
      return recentes.map((r) => (emojiDados as EntradaEmoji[]).find((e) => e.emoji === r)).filter((e): e is EntradaEmoji => !!e);
    }
    return buscarEmoji(emojiDados as EntradaEmoji[], consulta, grupo);
  }, [consulta, grupo, recentes]);

  function escolher(e: string) {
    const novos = [e, ...recentes.filter((x) => x !== e)].slice(0, 40);
    setRecentes(novos);
    gravarRecentes(novos);
    aoEmoji(e);
  }

  const abaBase = "rounded-full px-3 py-1 text-sm";
  return (
    <section aria-label="Emojis, GIFs e figurinhas" className="rounded-[9px] border border-gray-200 bg-surface-raised p-3 shadow-popover">
      <div role="tablist" className="mb-2 flex flex-wrap items-center gap-1">
        <button type="button" role="tab" aria-selected className={`${abaBase} bg-highlight text-gray-900`}>Emojis</button>
        <button type="button" role="tab" aria-selected={false} disabled={!gif} title={gif ? undefined : AVISO_RECURSO_MOTOR}
          className={`${abaBase} text-gray-700 disabled:cursor-not-allowed disabled:text-disabled`}>GIFs</button>
        <button type="button" role="tab" aria-selected={false} disabled={!figurinha} title={figurinha ? undefined : AVISO_RECURSO_MOTOR}
          className={`${abaBase} text-gray-700 disabled:cursor-not-allowed disabled:text-disabled`}>Figurinhas</button>
        <Botao variante="fantasma" tamanho="sm" onClick={aoFechar} aria-label="Fechar emojis" className="ml-auto">Fechar</Botao>
      </div>
      {(!gif || !figurinha) && <p className="mb-2 text-xs text-gray-600">GIFs e figurinhas: {AVISO_RECURSO_MOTOR}</p>}
      <input type="search" aria-label="Pesquisar emojis" placeholder="Pesquisar emojis" value={consulta}
        onChange={(e) => { setConsulta(e.target.value); setLimite(LIMITE_INICIAL); }}
        className="mb-2 w-full rounded-full border border-gray-200 bg-surface px-3 py-1.5 text-sm" />
      <div role="group" aria-label="Categorias de emoji" className="mb-2 flex flex-wrap gap-1">
        <button type="button" aria-label="Emojis recentes" aria-pressed={grupo === "recentes"}
          onClick={() => { setGrupo("recentes"); setLimite(LIMITE_INICIAL); }}
          className={`${abaBase} ${grupo === "recentes" ? "bg-highlight" : ""}`}>🕘</button>
        {Object.entries(GRUPOS).map(([id, [rotulo, icone]]) => (
          <button key={id} type="button" aria-label={rotulo} aria-pressed={grupo === id}
            onClick={() => { setGrupo(id); setLimite(LIMITE_INICIAL); }}
            className={`${abaBase} ${grupo === id ? "bg-highlight" : ""}`}>{icone}</button>
        ))}
      </div>
      <div className="grid max-h-56 grid-cols-[repeat(auto-fill,minmax(2.25rem,1fr))] gap-1 overflow-y-auto">
        {lista.slice(0, limite).map((e) => (
          <button key={e.emoji} type="button" aria-label={`${e.label} ${e.emoji}`} onClick={() => escolher(e.emoji)}
            className="rounded p-1 text-xl hover:bg-highlight">{e.emoji}</button>
        ))}
      </div>
      {lista.length > limite && (
        <Botao variante="secundario" tamanho="sm" onClick={() => setLimite(limite + LIMITE_INICIAL)} className="mt-2 w-full">
          Mostrar mais emojis
        </Botao>
      )}
      {!lista.length && <EstadoVazio>{grupo === "recentes" && !consulta.trim() ? "Os emojis usados aparecerão aqui." : "Nenhum emoji encontrado."}</EstadoVazio>}
    </section>
  );
}

export default SeletorEmoji;
