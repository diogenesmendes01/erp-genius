/** Radix Select monta as opções num DocumentFragment mesmo fechado. O Node de teste não tem esse construtor. */
export function garantirFragmentoDocumento() {
  if (typeof globalThis.DocumentFragment === "function") return;
  function Fragmento(this: {
    nodeType: number;
    nodeName: string;
    childNodes: Node[];
    parentNode: null;
    onclick: ((ev: Event) => void) | null;
    ownerDocument: Document | null;
  }) {
    this.nodeType = 11;
    this.nodeName = "#document-fragment";
    this.childNodes = [];
    this.parentNode = null;
    this.onclick = null;
    this.ownerDocument = typeof document === "undefined" ? null : document;
  }
  Fragmento.prototype.appendChild = function appendChild<T extends Node>(this: { childNodes: Node[] }, no: T) {
    const pai = no.parentNode as { removeChild?: (filho: Node) => void } | null;
    pai?.removeChild?.(no);
    this.childNodes.push(no);
    return no;
  };
  Fragmento.prototype.removeChild = function removeChild<T extends Node>(this: { childNodes: Node[] }, no: T) {
    const i = this.childNodes.indexOf(no);
    if (i >= 0) this.childNodes.splice(i, 1);
    return no;
  };
  Fragmento.prototype.insertBefore = function insertBefore<T extends Node>(this: { childNodes: Node[]; appendChild: (no: T) => T }, no: T, ref: Node | null) {
    if (!ref) return this.appendChild(no);
    const i = this.childNodes.indexOf(ref);
    if (i < 0) return this.appendChild(no);
    const pai = no.parentNode as { removeChild?: (filho: Node) => void } | null;
    pai?.removeChild?.(no);
    this.childNodes.splice(i, 0, no);
    return no;
  };
  Fragmento.prototype.contains = function contains(this: unknown, no: Node | null) {
    for (let atual = no; atual; atual = atual.parentNode) if (atual === this) return true;
    return false;
  };
  Object.defineProperty(globalThis, "DocumentFragment", { value: Fragmento, configurable: true });
}
