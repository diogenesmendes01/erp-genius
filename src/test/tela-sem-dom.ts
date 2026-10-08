import type { ReactNode } from "react";
import { Campo, type LigacaoCampo } from "@/components/Campo";

// Teste de interação de componente cliente sem DOM (sem jsdom, como o resto da suíte): o componente é
// chamado como função, com `useState`/`useCallback` do React trocados pelos ganchos daqui (o teste faz
// `vi.mock("react", …)` apontando para `criarGanchos()`), e a árvore devolvida é percorrida para achar
// botões e campos e disparar onClick/onChange. Cada `renderizar` é um novo render com o estado guardado
// por posição, como no React. Os <Campo> são expandidos: a função filha recebe a ligação e o controle
// devolvido entra na árvore.
//
// LIMITE (de propósito): useState e useCallback são simulados; useRef e useId também, guardados por
// posição como o estado (o ref e o id ficam os mesmos entre renders — uma chave de idempotência num
// useRef não muda a cada render), para o teste que os ligar no `vi.mock("react", …)`. Efeitos
// (useEffect/useLayoutEffect) não rodam — o teste que precisar os troca por função vazia — e
// useMemo/useTransition/useContext não existem aqui: um componente testado assim que passar a chamar um
// deles direto no corpo falha no teste ("Invalid hook call"), e o teste precisa acompanhar. Componentes
// filhos (Drawer, FeedbackAcao, Campo, ConfirmarAcao…) não são chamados: só as props deles são lidas.

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

/** A ligação que o Campo entregaria ao controle (o id é o que importa para o teste). */
function ligacaoDe(campo: No): LigacaoCampo {
  return { id: String(campo.props.id ?? "campo-sem-id") };
}

/** Todos os elementos da árvore, em pré-ordem (props na ordem do JSX, children por último). */
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

/** Texto visível de um nó (strings e números dos filhos). */
export function texto(v: unknown): string {
  if (typeof v === "string" || typeof v === "number") return String(v);
  if (Array.isArray(v)) return v.map(texto).join("");
  if (ehNo(v)) return texto(v.props.children);
  return "";
}

/** Os <Campo> da árvore, na ordem da tela. */
export const campos = (raiz: ReactNode) => elementos(raiz).filter((n) => n.type === Campo);

export function campo(raiz: ReactNode, id: string): No {
  const achados = campos(raiz).filter((c) => c.props.id === id);
  if (achados.length !== 1) throw new Error(`esperava 1 Campo com id "${id}", achei ${achados.length}`);
  return achados[0];
}

/** O controle ligado ao Campo (o que a função filha devolve). */
export function controle(c: No): No {
  const filho = c.props.children as (l: LigacaoCampo) => ReactNode;
  const no = filho(ligacaoDe(c));
  if (!ehNo(no)) throw new Error(`Campo "${String(c.props.id)}" não devolveu um elemento`);
  return no;
}

/** Botão pelo texto exato. */
export function botao(raiz: ReactNode, rotulo: string): No {
  const achados = elementos(raiz).filter((n) => n.type === "button" && texto(n.props.children).trim() === rotulo);
  if (achados.length !== 1) throw new Error(`esperava 1 botão "${rotulo}", achei ${achados.length}`);
  return achados[0];
}

/** Clica no botão (pelo texto exato); devolve o que o onClick devolver (a promessa, quando assíncrono). */
export function clicar(raiz: ReactNode, rotulo: string): unknown {
  return (botao(raiz, rotulo).props.onClick as () => unknown)();
}

/** Erro de cada <Campo> que tem erro, por id, na ordem da tela. */
export const errosDosCampos = (raiz: ReactNode): Record<string, unknown> =>
  Object.fromEntries(campos(raiz).filter((c) => c.props.erro).map((c) => [String(c.props.id), c.props.erro]));

export const temBotao =(raiz: ReactNode, rotulo: string) =>
  elementos(raiz).some((n) => n.type === "button" && texto(n.props.children).trim() === rotulo);

/**
 * Digita/escolhe no controle do Campo. Elemento nativo e quem recebe o evento (`eventoNativo`)
 * ganham `{ target: { value } }`; componente que entrega o valor direto (CampoMoeda, SelectISO) ganha
 * o valor.
 */
export function preencher(raiz: ReactNode, id: string, valor: string, eventoNativo: unknown[] = []) {
  const c = controle(campo(raiz, id));
  const onChange = c.props.onChange as (v: unknown) => void;
  if (typeof c.type === "string" || eventoNativo.includes(c.type)) onChange({ target: { value: valor } });
  else onChange(valor);
}

/** Ids focados por focarPrimeiroComErro / getElementById(...).focus() — com `document` simulado. */
export function documentoQueRegistraFoco() {
  const focados: string[] = [];
  return { focados, documento: { getElementById: (id: string) => ({ focus: () => focados.push(id) }) } };
}
