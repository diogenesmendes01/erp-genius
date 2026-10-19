// DOM mínimo para rodar o react-dom/client de verdade num teste (sem jsdom: a suíte não depende dele, e
// agentes não mexem em package/lockfile). Cobre só o que o React 18 usa para montar, atualizar e desmontar
// elementos simples, texto e portal — createElement/createTextNode, appendChild/insertBefore/removeChild,
// atributos, textContent/nodeValue, foco (`document.activeElement`, `focus()` que falha dentro de `inert`,
// como no navegador), `inert` refletido no atributo, `closest`/`querySelectorAll` com seletores simples
// (`tag`, `[attr]`, `[attr='v']`, `:not(...)`, lista com vírgula) e um MutationObserver que entrega os
// registros numa microtask, depois do trecho síncrono que mutou o DOM (o commit inteiro do React).
//
// LIMITE (de propósito): não há eventos despachados (addEventListener só guarda), layout, estilos
// calculados, seleção de texto nem namespaces além do HTML. Quem precisar disso aqui terá de acrescentar.
//
// Os globais (`criarDomMinimo`) precisam estar no lugar ANTES de importar react-dom (ele decide `canUseDOM`
// ao carregar): no teste, importe o React DOM e os componentes com `await import(...)` depois de instalar.

type Registro = { type: "childList" | "characterData" | "attributes"; target: No; attributeName?: string };
type OpcoesObservador = { subtree?: boolean; childList?: boolean; characterData?: boolean; attributes?: boolean };

const observadores = new Set<ObservadorMinimo>();

function notificar(registro: Registro) {
  for (const obs of observadores) obs.considerar(registro);
}

export class ObservadorMinimo {
  private alvos: { no: No; opcoes: OpcoesObservador }[] = [];
  private fila: Registro[] = [];
  private agendado = false;
  constructor(private readonly callback: (registros: Registro[], obs: ObservadorMinimo) => void) {}
  observe(no: No, opcoes: OpcoesObservador) {
    this.alvos.push({ no, opcoes });
    observadores.add(this);
  }
  disconnect() {
    this.alvos = [];
    this.fila = [];
    observadores.delete(this);
  }
  takeRecords() {
    const r = this.fila;
    this.fila = [];
    return r;
  }
  considerar(r: Registro) {
    const casa = this.alvos.some(({ no, opcoes }) => {
      if (r.type === "childList" && !opcoes.childList) return false;
      if (r.type === "characterData" && !opcoes.characterData) return false;
      if (r.type === "attributes" && !opcoes.attributes) return false;
      return r.target === no || (!!opcoes.subtree && no.contains(r.target));
    });
    if (!casa) return;
    this.fila.push(r);
    if (this.agendado) return;
    this.agendado = true;
    queueMicrotask(() => {
      this.agendado = false;
      const registros = this.takeRecords();
      if (registros.length > 0) this.callback(registros, this);
    });
  }
}

export class No {
  parentNode: No | null = null;
  childNodes: No[] = [];
  ownerDocument: Documento | null;
  constructor(readonly nodeType: number, readonly nodeName: string, dono: Documento | null) {
    this.ownerDocument = dono;
  }
  get parentElement(): Elemento | null {
    return this.parentNode instanceof Elemento ? this.parentNode : null;
  }
  get firstChild(): No | null { return this.childNodes[0] ?? null; }
  get lastChild(): No | null { return this.childNodes[this.childNodes.length - 1] ?? null; }
  get nextSibling(): No | null {
    const irmaos = this.parentNode?.childNodes;
    return irmaos ? irmaos[irmaos.indexOf(this) + 1] ?? null : null;
  }
  get previousSibling(): No | null {
    const irmaos = this.parentNode?.childNodes;
    return irmaos ? irmaos[irmaos.indexOf(this) - 1] ?? null : null;
  }
  get isConnected(): boolean {
    return this.raiz() instanceof Documento;
  }
  private raiz(): No {
    return this.parentNode ? this.parentNode.raiz() : this;
  }
  appendChild<T extends No>(filho: T): T { return this.insertBefore(filho, null); }
  insertBefore<T extends No>(filho: T, referencia: No | null): T {
    filho.parentNode?.removeChild(filho);
    const i = referencia ? this.childNodes.indexOf(referencia) : -1;
    if (i < 0) this.childNodes.push(filho);
    else this.childNodes.splice(i, 0, filho);
    filho.parentNode = this;
    notificar({ type: "childList", target: this });
    return filho;
  }
  removeChild<T extends No>(filho: T): T {
    const i = this.childNodes.indexOf(filho);
    if (i < 0) throw new Error("removeChild: não é filho deste nó");
    this.childNodes.splice(i, 1);
    filho.parentNode = null;
    notificar({ type: "childList", target: this });
    return filho;
  }
  contains(outro: No | null): boolean {
    for (let n = outro; n; n = n.parentNode) if (n === this) return true;
    return false;
  }
  get textContent(): string {
    return this.childNodes.map((c) => c.textContent).join("");
  }
  set textContent(texto: string) {
    for (const c of this.childNodes) c.parentNode = null;
    this.childNodes = [];
    if (texto) {
      const t = new Texto(texto, this.ownerDocument);
      t.parentNode = this;
      this.childNodes.push(t);
    }
    notificar({ type: "childList", target: this });
  }
  addEventListener() {}
  removeEventListener() {}
}

export class Texto extends No {
  private valor: string;
  constructor(texto: string, dono: Documento | null) {
    super(3, "#text", dono);
    this.valor = texto;
  }
  get nodeValue() { return this.valor; }
  set nodeValue(v: string) {
    this.valor = v;
    notificar({ type: "characterData", target: this });
  }
  get data() { return this.valor; }
  set data(v: string) { this.nodeValue = v; }
  override get textContent() { return this.valor; }
  override set textContent(v: string) { this.nodeValue = v; }
}

// Seletor simples: `tag`, `[attr]`, `[attr='v']`/`[attr="v"]`/`[attr=v]` e `:not(<simples>)`, encadeados.
function casaSeletor(el: Elemento, seletor: string): boolean {
  return seletor.split(",").some((parte) => casaComposto(el, parte.trim()));
}

function casaComposto(el: Elemento, composto: string): boolean {
  let resto = composto;
  const tag = /^[a-zA-Z][a-zA-Z0-9-]*/.exec(resto);
  if (tag) {
    if (el.localName !== tag[0].toLowerCase()) return false;
    resto = resto.slice(tag[0].length);
  }
  while (resto.length > 0) {
    const not = /^:not\(([^()]*)\)/.exec(resto);
    if (not) {
      if (casaComposto(el, not[1])) return false;
      resto = resto.slice(not[0].length);
      continue;
    }
    const attr = /^\[([a-zA-Z-]+)(?:=(?:'([^']*)'|"([^"]*)"|([^\]]*)))?\]/.exec(resto);
    if (!attr) throw new Error(`dom-minimo: seletor não suportado: ${composto}`);
    const valor = el.getAttribute(attr[1]);
    const esperado = attr[2] ?? attr[3] ?? attr[4];
    if (valor === null || (esperado !== undefined && valor !== esperado)) return false;
    resto = resto.slice(attr[0].length);
  }
  return true;
}

export class Elemento extends No {
  readonly namespaceURI = "http://www.w3.org/1999/xhtml";
  readonly localName: string;
  readonly tagName: string;
  readonly style: Record<string, unknown> & { setProperty(n: string, v: string): void } = {
    setProperty(n: string, v: string) { (this as Record<string, unknown>)[n] = v; },
  };
  private atributos = new Map<string, string>();
  constructor(tag: string, dono: Documento | null) {
    super(1, tag.toUpperCase(), dono);
    this.localName = tag.toLowerCase();
    this.tagName = tag.toUpperCase();
  }
  get children(): Elemento[] { return this.childNodes.filter((c): c is Elemento => c instanceof Elemento); }
  getAttribute(nome: string) { return this.atributos.get(nome.toLowerCase()) ?? null; }
  hasAttribute(nome: string) { return this.atributos.has(nome.toLowerCase()); }
  setAttribute(nome: string, valor: unknown) {
    this.atributos.set(nome.toLowerCase(), String(valor));
    notificar({ type: "attributes", target: this, attributeName: nome.toLowerCase() });
  }
  removeAttribute(nome: string) {
    if (!this.atributos.delete(nome.toLowerCase())) return;
    notificar({ type: "attributes", target: this, attributeName: nome.toLowerCase() });
  }
  get id() { return this.getAttribute("id") ?? ""; }
  /** Refletido no atributo, como no navegador: `closest("[inert]")` enxerga. */
  get inert() { return this.hasAttribute("inert"); }
  set inert(v: boolean) {
    if (v) this.setAttribute("inert", "");
    else this.removeAttribute("inert");
  }
  closest(seletor: string): Elemento | null {
    if (casaSeletor(this, seletor)) return this;
    return this.parentElement?.closest(seletor) ?? null;
  }
  querySelectorAll(seletor: string): Elemento[] {
    const achados: Elemento[] = [];
    const visitar = (n: No) => {
      for (const c of n.childNodes) {
        if (c instanceof Elemento) {
          if (casaSeletor(c, seletor)) achados.push(c);
          visitar(c);
        }
      }
    };
    visitar(this);
    return achados;
  }
  querySelector(seletor: string) { return this.querySelectorAll(seletor)[0] ?? null; }
  /** Como no navegador: fora da página ou dentro de `inert`, o foco não muda. */
  focus() {
    const doc = this.ownerDocument;
    if (!doc || !this.isConnected || this.closest("[inert]")) return;
    doc.ativo = this;
  }
  blur() {
    const doc = this.ownerDocument;
    if (doc && doc.ativo === this) doc.ativo = null;
  }
}

export class Documento extends No {
  readonly documentElement: Elemento;
  readonly head: Elemento;
  readonly body: Elemento;
  ativo: Elemento | null = null;
  constructor() {
    super(9, "#document", null);
    this.documentElement = this.createElement("html");
    this.head = this.createElement("head");
    this.body = this.createElement("body");
    this.appendChild(this.documentElement);
    this.documentElement.appendChild(this.head);
    this.documentElement.appendChild(this.body);
  }
  /** Quem tem o foco; se saiu da página, volta ao <body> (como no navegador). */
  get activeElement(): Elemento {
    return this.ativo && this.ativo.isConnected ? this.ativo : this.body;
  }
  createElement(tag: string) { return new Elemento(tag, this); }
  createTextNode(texto: string) { return new Texto(texto, this); }
  getElementById(id: string) { return this.documentElement.querySelectorAll(`[id='${id}']`)[0] ?? null; }
}

class HTMLIFrameElementMinimo {}

/**
 * O documento, a janela e o MutationObserver para pôr no escopo global — no teste, com
 * `vi.stubGlobal("window", …)`, `vi.stubGlobal("document", …)` e `vi.stubGlobal("MutationObserver", …)`, e
 * `vi.unstubAllGlobals()` no fim. A instalação fica no teste de propósito: mexer no global da janela num fonte
 * comum acusa na trava de `window.confirm` (src/app/confirmacoes.test.ts).
 */
export function criarDomMinimo() {
  const documento = new Documento();
  const janela: Record<string, unknown> = {
    document: documento,
    HTMLIFrameElement: HTMLIFrameElementMinimo,
    location: { protocol: "about:" },
    addEventListener() {},
    removeEventListener() {},
    event: undefined, // sem evento em andamento: o React usa a prioridade padrão (como depois de um `await`)
  };
  janela.top = janela;
  janela.self = janela;
  return { documento, janela, MutationObserver: ObservadorMinimo };
}

/** Esquece os observadores ligados (fim do teste). */
export function desligarObservadores() {
  observadores.clear();
}
