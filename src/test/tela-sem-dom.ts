import { Suspense, cloneElement, type ReactElement, type ReactNode } from "react";
import { Campo, type LigacaoCampo } from "@/components/Campo";
import { Botao } from "@/components/Botao";

type Setter<T> = (v: T | ((anterior: T) => T)) => void;

export function criarGanchos() {
  let estados: unknown[] = [];
  let posicao = 0;
  return {
    useState<T>(inicial: T | (() => T)): [T, Setter<T>] {
      const k = posicao++;
      if (k >= estados.length) estados.push(typeof inicial === "function" ? (inicial as () => T)() : inicial);
      const set: Setter<T> = (v) => {
        estados[k] = typeof v === "function" ? (v as (anterior: T) => T)(estados[k] as T) : v;
      };
      return [estados[k] as T, set];
    },
    useCallback<F>(f: F): F {
      return f;
    },
    useRef<T>(inicial: T): { current: T } {
      const k = posicao++;
      if (k >= estados.length) estados.push({ current: inicial });
      return estados[k] as { current: T };
    },
    useId(): string {
      const k = posicao++;
      if (k >= estados.length) estados.push(`id-${k}`);
      return estados[k] as string;
    },
    renderizar<P>(componente: (props: P) => ReactNode, props: P): ReactNode {
      posicao = 0;
      return componente(props);
    },
    reiniciar() {
      estados = [];
      posicao = 0;
    },
  };
}

export type Ganchos = ReturnType<typeof criarGanchos>;

export type No = { type: unknown; props: Record<string, unknown> };

const ehNo = (v: unknown): v is No => !!v && typeof v === "object" && "type" in v && "props" in v;

function ligacaoDe(campo: No): LigacaoCampo {
  return { id: String(campo.props.id ?? "campo-sem-id") };
}

export function elementos(raiz: ReactNode): No[] {
  const saida: No[] = [];
  const visita = (v: unknown) => {
    if (Array.isArray(v)) { v.forEach(visita); return; }
    if (!ehNo(v)) return;
    saida.push(v);
    for (const [chave, valor] of Object.entries(v.props)) {
      if (chave === "children" && v.type === Campo && typeof valor === "function") visita((valor as (l: LigacaoCampo) => ReactNode)(ligacaoDe(v)));
      else visita(valor);
    }
  };
  visita(raiz);
  return saida;
}

export function identidadeNoReact(raiz: ReactNode, tipo: unknown): { caminho: number[]; key: string | null } | null {
  const busca = (v: unknown, caminho: number[]): { caminho: number[]; key: string | null } | null => {
    if (Array.isArray(v)) {
      for (let i = 0; i < v.length; i++) { const r = busca(v[i], [...caminho, i]); if (r) return r; }
      return null;
    }
    if (!ehNo(v)) return null;
    if (v.type === tipo) return { caminho, key: (v as { key?: string | null }).key ?? null };
    const filhos = v.props.children;
    return Array.isArray(filhos) ? busca(filhos, caminho) : busca(filhos, [...caminho, 0]);
  };
  return busca(raiz, []);
}

export function primeiraPintura(v: ReactNode): ReactNode {
  if (Array.isArray(v)) return v.map(primeiraPintura);
  if (!v || typeof v !== "object" || !("props" in v)) return v;
  const el = v as ReactElement<{ children?: ReactNode; fallback?: ReactNode }>;
  if (el.type === Suspense) return primeiraPintura(el.props.fallback);
  const filhos = el.props.children;
  if (filhos === undefined || typeof filhos === "function") return el;
  return cloneElement(el, undefined, ...(Array.isArray(filhos) ? filhos.map(primeiraPintura) : [primeiraPintura(filhos)]));
}

export function texto(v: unknown): string {
  if (typeof v === "string" || typeof v === "number") return String(v);
  if (Array.isArray(v)) return v.map(texto).join("");
  if (ehNo(v)) return texto(v.props.children);
  return "";
}

export const campos = (raiz: ReactNode) => elementos(raiz).filter((n) => n.type === Campo);

export function campo(raiz: ReactNode, id: string): No {
  const achados = campos(raiz).filter((c) => c.props.id === id);
  if (achados.length !== 1) throw new Error(`esperava 1 Campo com id "${id}", achei ${achados.length}`);
  return achados[0];
}

export function controle(c: No): No {
  const filho = c.props.children as (l: LigacaoCampo) => ReactNode;
  const no = filho(ligacaoDe(c));
  if (!ehNo(no)) throw new Error(`Campo "${String(c.props.id)}" não devolveu um elemento`);
  return no;
}

export function botao(raiz: ReactNode, rotulo: string): No {
  const achados = elementos(raiz).filter((n) => n.type === "button" && texto(n.props.children).trim() === rotulo);
  if (achados.length !== 1) throw new Error(`esperava 1 botão "${rotulo}", achei ${achados.length}`);
  return achados[0];
}

export function clicar(raiz: ReactNode, rotulo: string): unknown {
  return (botao(raiz, rotulo).props.onClick as () => unknown)();
}

export function botaoOuBotao(raiz: ReactNode, rotulo: string): No {
  const achados = elementos(raiz).filter((n) => (n.type === "button" || n.type === Botao) && texto(n.props.children).trim() === rotulo);
  if (achados.length !== 1) throw new Error(`esperava 1 botão "${rotulo}", achei ${achados.length}`);
  return achados[0];
}

export function clicarBotao(raiz: ReactNode, rotulo: string): unknown {
  return (botaoOuBotao(raiz, rotulo).props.onClick as (e: unknown) => unknown)({ preventDefault() {}, stopPropagation() {} });
}

const VALORES = Symbol("valores do formulário falso");
type ValoresFormulario = Record<string, string | string[]>;

export function formularioFalso(valores: ValoresFormulario = {}) {
  return { [VALORES]: valores, reset() {}, elements: {} };
}

export class FormDataFalso {
  private readonly valores: ValoresFormulario;
  constructor(form?: unknown) {
    this.valores = (form && typeof form === "object" && VALORES in form ? (form as { [VALORES]: ValoresFormulario })[VALORES] : {});
  }
  get(nome: string): string | null {
    const v = this.valores[nome];
    return v === undefined ? null : Array.isArray(v) ? v[0] ?? null : v;
  }
  getAll(nome: string): string[] {
    const v = this.valores[nome];
    return v === undefined ? [] : Array.isArray(v) ? v : [v];
  }
  has(nome: string): boolean {
    return nome in this.valores;
  }
  *entries(): IterableIterator<[string, string]> {
    for (const [nome, v] of Object.entries(this.valores)) for (const x of Array.isArray(v) ? v : [v]) yield [nome, x];
  }
  [Symbol.iterator]() {
    return this.entries();
  }
}

export const formularios = (raiz: ReactNode) => elementos(raiz).filter((n) => n.type === "form" && typeof n.props.onSubmit === "function");

export function submeter(raiz: ReactNode, valores: ValoresFormulario = {}, indice = 0): unknown {
  const lista = formularios(raiz);
  if (!lista[indice]) throw new Error(`esperava um <form> com onSubmit na posição ${indice}, achei ${lista.length}`);
  const form = formularioFalso(valores);
  return (lista[indice].props.onSubmit as (e: unknown) => unknown)({ preventDefault() {}, currentTarget: form, target: form });
}

export const errosDosCampos = (raiz: ReactNode): Record<string, unknown> =>
  Object.fromEntries(campos(raiz).filter((c) => c.props.erro).map((c) => [String(c.props.id), c.props.erro]));

export const temBotao =(raiz: ReactNode, rotulo: string) =>
  elementos(raiz).some((n) => n.type === "button" && texto(n.props.children).trim() === rotulo);

export function preencher(raiz: ReactNode, id: string, valor: string, eventoNativo: unknown[] = []) {
  const c = controle(campo(raiz, id));
  const onChange = c.props.onChange as (v: unknown) => void;
  if (typeof c.type === "string" || eventoNativo.includes(c.type)) onChange({ target: { value: valor } });
  else onChange(valor);
}

export function documentoQueRegistraFoco() {
  const focados: string[] = [];
  return { focados, documento: { getElementById: (id: string) => ({ focus: () => focados.push(id) }) } };
}
