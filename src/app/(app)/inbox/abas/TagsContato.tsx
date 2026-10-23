"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent as EventoTeclado } from "react";
import { IconSparkles } from "@tabler/icons-react";
import { Botao } from "@/components/Botao";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { posicaoPopover } from "@/lib/popover";
import type { TagPainel } from "@/server/inbox/paineis";
import { atribuirTagNoInbox, removerTagNoInbox, criarEAtribuirTagNoInbox } from "@/server/inbox/acoes-painel";

type Opcao = { id: string; nome: string };
export type PropsTagsContato = { atendimentoId: string; tags: TagPainel[]; disponiveis: Opcao[]; podeEditar: boolean; podeCriar: boolean; aoMudar(): void };
const normalizar = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();
export function tagsParaEscolher(disponiveis: Opcao[], atuais: TagPainel[], busca: string): Opcao[] {
  const ids = new Set(atuais.map(t => t.id)), termo = normalizar(busca);
  return disponiveis.filter(t => !ids.has(t.id) && normalizar(t.nome).includes(termo)).slice(0, 8);
}
/** A limitação visual a oito nunca decide se o nome já existe no catálogo. */
export function podeCriarTagComBusca(disponiveis: Opcao[], busca: string): boolean {
  const termo = normalizar(busca);
  return !!termo && !disponiveis.some(t => normalizar(t.nome) === termo);
}
export function TagsContato(props: PropsTagsContato) { return <TagsDoAtendimento key={props.atendimentoId} {...props} />; }
function TagsDoAtendimento({ atendimentoId, tags, disponiveis, podeEditar, podeCriar, aoMudar }: PropsTagsContato) {
  const [aberto, setAberto] = useState(false), [busca, setBusca] = useState("");
  const acao = useAcaoCliente({ idempotente: true }); const id = useId();
  const gatilho = useRef<HTMLButtonElement>(null), painel = useRef<HTMLDivElement>(null), campo = useRef<HTMLInputElement>(null);
  const vivo = useRef(false), revisao = useRef(0);
  useEffect(() => { vivo.current = true; return () => { vivo.current = false; }; }, []);
  const fechar = useCallback((focar: boolean) => { setAberto(false); if (focar) gatilho.current?.focus({ preventScroll: true }); }, []);
  const opcoes = tagsParaEscolher(disponiveis, tags, busca);
  const criar = podeEditar && podeCriar && podeCriarTagComBusca(disponiveis, busca);
  useLayoutEffect(() => {
    if (!aberto || !gatilho.current || !painel.current) return;
    const a = gatilho.current.getBoundingClientRect(), p = painel.current.getBoundingClientRect();
    const pos = posicaoPopover({ ancora: a, painel: { largura: p.width, altura: p.height }, viewport: { largura: window.innerWidth, altura: window.innerHeight } });
    painel.current.style.top = pos.topo + "px"; painel.current.style.left = pos.esquerda + "px"; painel.current.style.visibility = "visible";
  }, [aberto, busca, tags, disponiveis, podeCriar]);
  useEffect(() => {
    if (!aberto) return;
    campo.current?.focus({ preventScroll: true });
    const fora = (e: Event) => { const alvo = e.target as Node; if (!painel.current?.contains(alvo) && !gatilho.current?.contains(alvo)) fechar(false); };
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape" && !e.defaultPrevented) { e.preventDefault(); e.stopPropagation(); fechar(true); } };
    const rolou = (e: Event) => { if (!painel.current?.contains(e.target as Node)) fechar(false); };
    const mudou = () => fechar(false);
    document.addEventListener("mousedown", fora); document.addEventListener("keydown", tecla, true);
    window.addEventListener("scroll", rolou, true); window.addEventListener("resize", mudou);
    return () => { document.removeEventListener("mousedown", fora); document.removeEventListener("keydown", tecla, true); window.removeEventListener("scroll", rolou, true); window.removeEventListener("resize", mudou); };
  }, [aberto, fechar]);
  async function executar(tipo: "atribuir" | "remover" | "criar", valor: string) {
    if (!podeEditar || (tipo === "criar" && !podeCriar)) return;
    const versao = revisao.current;
    const d = await acao.executar<unknown>(() => tipo === "atribuir" ? atribuirTagNoInbox(atendimentoId, valor) : tipo === "remover" ? removerTagNoInbox(atendimentoId, valor) : criarEAtribuirTagNoInbox(atendimentoId, valor));
    if (d?.tipo !== "ok" || !vivo.current) return;
    if (versao === revisao.current && tipo !== "remover") { fechar(!!painel.current?.contains(document.activeElement)); setBusca(""); }
    aoMudar();
  }
  function teclado(e: EventoTeclado<HTMLDivElement>) {
    if (e.defaultPrevented || e.nativeEvent?.isComposing) return;
    const input = campo.current, alvo = e.target;
    if (alvo === input && (e.key === "Home" || e.key === "End")) return;
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
    const botoes = Array.from(painel.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []);
    const todos = input ? [input, ...botoes] : botoes;
    if (!todos.length) return;
    const indice = todos.indexOf(alvo as HTMLButtonElement);
    const proximo = e.key === "Home" ? (input && botoes.length ? 1 : 0) : e.key === "End" ? todos.length - 1 : (indice + (e.key === "ArrowUp" ? -1 : 1) + todos.length) % todos.length;
    e.preventDefault(); todos[proximo]?.focus({ preventScroll: true });
  }
  if (!tags.length && !podeEditar) return null;
  return <div className="w-full max-w-full">
    <div className="flex max-w-full flex-wrap justify-center gap-1.5">
      {tags.map(tag => <span key={tag.id} className="inline-flex min-h-[26px] max-w-full items-center gap-[5px] rounded-[13px] bg-surface-muted px-2.5 text-[12.5px] [overflow-wrap:anywhere]">
        {tag.ia && <IconSparkles size={11} className="shrink-0 text-ai-700" aria-label="Criada pela Aria" />}<span className="min-w-0">{tag.rotulo}</span>
        {podeEditar && <button type="button" aria-label={"Remover tag " + tag.rotulo} disabled={acao.ocupado} onClick={() => void executar("remover", tag.id)} className="inline-flex shrink-0 items-center justify-center rounded-full text-gray-600 hover:bg-highlight max-sm:min-h-11 max-sm:min-w-11">×</button>}
      </span>)}
      {podeEditar && <Botao ref={gatilho} variante="fantasma" tamanho="sm" disabled={acao.ocupado} aria-expanded={aberto} aria-controls={aberto ? id : undefined} aria-haspopup="dialog" className="min-h-[26px] rounded-[13px] border border-dashed border-gray-300 text-gray-600" onClick={() => { acao.limpar(); setAberto(v => !v); }}>+ tag</Botao>}
    </div>
    {aberto && podeEditar && <div ref={painel} id={id} onKeyDown={teclado} role="dialog" aria-label="Escolher tag" style={{ position: "fixed", top: 0, left: 0, visibility: "hidden", zIndex: 50 }} className="w-[280px] max-w-[calc(100vw-16px)] max-h-[calc(100dvh-16px)] overflow-y-auto overscroll-contain rounded-dialog border border-gray-200 bg-surface-raised p-2 shadow-popover">
      <input ref={campo} aria-label="Buscar tag" placeholder="Buscar tag" value={busca} maxLength={40} onChange={e => { revisao.current++; setBusca(e.target.value); }} className="mb-2 min-h-11 w-full rounded border border-gray-300 bg-surface px-3 py-2 text-sm" />
      <div className="flex flex-col gap-1">{opcoes.map(t => <Botao key={t.id} variante="fantasma" tamanho="sm" disabled={acao.ocupado} className="justify-start text-left" onClick={() => void executar("atribuir", t.id)}>{t.nome}</Botao>)}
        {!opcoes.length && <p className="p-2 text-sm text-gray-600">Nenhuma tag encontrada.</p>}
        {criar && <Botao variante="fantasma" tamanho="sm" disabled={acao.ocupado} className="justify-start text-left" onClick={() => void executar("criar", busca)}>Criar tag “{busca.trim()}”</Botao>}
      </div>
      <FeedbackAcao erro={acao.erro} />
    </div>}
    {!aberto && <FeedbackAcao erro={acao.erro} />}
  </div>;
}
