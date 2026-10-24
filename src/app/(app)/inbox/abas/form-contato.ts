import type { OrigemCanal } from "@prisma/client";
import type { DetalhesPainel } from "@/server/inbox/painel-detalhes";
import type { EditarContatoInbox } from "@/server/inbox/acoes-painel";
import type { ValorCampo } from "@/server/crm/campos";

export type FormContato = {
  nome: string; email: string; cidade: string; cargo: string; linkedin: string;
  origemCanal: OrigemCanal | ""; campos: Record<string, ValorCampo>;
};
export type AlteracoesContato = Omit<EditarContatoInbox, "pessoaIdEsperada">;

/** A identidade da ficha fica fora do formulário e é enviada separadamente como precondição. */
export function formDoContato(d: DetalhesPainel): FormContato | null {
  const p = d.pessoa;
  if (!p) return null;
  return { nome: p.nome, email: p.email ?? "", cidade: p.cidade ?? "", cargo: p.cargo ?? "", linkedin: p.linkedin ?? "", origemCanal: p.origemCanal ?? "", campos: Object.fromEntries(d.campos.map(c => [c.id, c.valor])) };
}
const opcional = (v: string) => v.trim() || null;
function normalizar(f: FormContato) {
  return { nome: f.nome.trim(), email: opcional(f.email)?.toLowerCase() ?? null, cidade: opcional(f.cidade), cargo: opcional(f.cargo), linkedin: opcional(f.linkedin), origemCanal: f.origemCanal || null };
}
/** Somente campos da leitura original; zero/false e o nome vazio não são omitidos. */
export function diffContato(lido: FormContato, editado: FormContato): AlteracoesContato {
  const antes = normalizar(lido), depois = normalizar(editado);
  const pessoa = Object.fromEntries(Object.keys(antes).filter(k => antes[k as keyof typeof antes] !== depois[k as keyof typeof depois]).map(k => [k, depois[k as keyof typeof depois]]));
  const campos = Object.keys(lido.campos).filter(id => lido.campos[id] !== editado.campos[id]).map(campoId => ({ campoId, valor: editado.campos[campoId] ?? null }));
  return { ...(Object.keys(pessoa).length ? { pessoa } : {}), ...(campos.length ? { campos } : {}) };
}
