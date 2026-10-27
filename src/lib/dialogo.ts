import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";

export const SELETOR_FOCAVEL = [
  "a[href]", "button:not([disabled])", "input:not([disabled]):not([type=hidden])", "select:not([disabled])",
  "textarea:not([disabled])", "[tabindex]:not([tabindex='-1'])",
].join(",");

export function proximoFocoPreso<T>(focaveis: T[], atual: T | null, shift: boolean): T | null {
  if (focaveis.length === 0) return null;
  const primeiro = focaveis[0], ultimo = focaveis[focaveis.length - 1];
  const i = atual === null ? -1 : focaveis.indexOf(atual);
  if (i === -1) return shift ? ultimo : primeiro;
  if (shift && i === 0) return ultimo;
  if (!shift && i === focaveis.length - 1) return primeiro;
  return null;
}

export function criarPilhaDialogos() {
  const abertos: object[] = [];
  return {
    abrir(marca: object) { abertos.push(marca); },
    fechar(marca: object) {
      const i = abertos.lastIndexOf(marca);
      if (i >= 0) abertos.splice(i, 1);
    },
    noTopo(marca: object) { return abertos.length > 0 && abertos[abertos.length - 1] === marca; },
  };
}

const PILHA_DIALOGOS = criarPilhaDialogos();

type NoIsolavel = { inert: boolean; tagName: string };
const FORA_DO_ISOLAMENTO = new Set(["SCRIPT", "STYLE", "TEMPLATE", "LINK"]);

export function isolarFundo(camada: { parentElement: { children: ArrayLike<unknown> } | null }): () => void {
  const pai = camada.parentElement;
  if (!pai) return () => {};
  const marcados: NoIsolavel[] = [];
  for (const irmao of Array.from(pai.children) as NoIsolavel[]) {
    if ((irmao as unknown) === camada || irmao.inert || FORA_DO_ISOLAMENTO.has(irmao.tagName)) continue;
    irmao.inert = true;
    marcados.push(irmao);
  }
  return () => { for (const el of marcados) el.inert = false; };
}

function soltarUmaVez(desfazer: () => void): () => void {
  let feito = false;
  return () => {
    if (feito) return;
    feito = true;
    desfazer();
  };
}

const useEfeitoDeLayout = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function useDialogo(ref: RefObject<HTMLElement | null>, { aberto, aoFechar, bloquearFechamento = false, focoInicial, focoAoFechar, isolar }: {
  aberto: boolean;
  aoFechar: () => void;
  bloquearFechamento?: boolean;
  focoInicial?: RefObject<HTMLElement | null>;
  focoAoFechar?: RefObject<HTMLElement | null>;
  isolar?: RefObject<HTMLElement | null>;
}) {
  const fechar = useRef(aoFechar);
  const bloqueado = useRef(bloquearFechamento);
  const inicial = useRef(focoInicial);
  const retorno = useRef(focoAoFechar);
  useEffect(() => { fechar.current = aoFechar; bloqueado.current = bloquearFechamento; inicial.current = focoInicial; retorno.current = focoAoFechar; });
  const soltar = useRef<(() => void) | undefined>(undefined);

  useEfeitoDeLayout(() => {
    if (!aberto) return;
    return () => { soltar.current?.(); };
  }, [aberto, isolar]);

  useEffect(() => {
    if (!aberto) return;
    const marca = {};
    PILHA_DIALOGOS.abrir(marca);
    const anterior = document.activeElement as HTMLElement | null;
    const caixa = ref.current;
    const focaveis = () => (caixa ? [...caixa.querySelectorAll<HTMLElement>(SELETOR_FOCAVEL)].filter((el) => !el.closest("[inert]")) : []);
    (inicial.current?.current ?? focaveis()[0] ?? caixa)?.focus();
    const soltarFundo = isolar?.current ? soltarUmaVez(isolarFundo(isolar.current)) : undefined;
    soltar.current = soltarFundo;

    function onKey(e: KeyboardEvent) {
      if (!PILHA_DIALOGOS.noTopo(marca)) return;
      if (e.key === "Escape") {
        if (!bloqueado.current) { e.stopPropagation(); fechar.current(); }
        return;
      }
      if (e.key !== "Tab") return;
      const alvo = proximoFocoPreso(focaveis(), document.activeElement as HTMLElement | null, e.shiftKey);
      if (alvo) { e.preventDefault(); alvo.focus(); }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      PILHA_DIALOGOS.fechar(marca);
      document.removeEventListener("keydown", onKey);
      soltarFundo?.();
      if (soltar.current === soltarFundo) soltar.current = undefined;
      const destino = retorno.current === undefined ? anterior : retorno.current.current;
      if (destino && document.contains(destino)) destino.focus();
    };
  }, [aberto, ref, isolar]);
}
