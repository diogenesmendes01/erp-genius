import type { Papel } from "@prisma/client";
import { podeExecutar } from "@/server/inbox/permissoes";
import type { Setor } from "@/server/whatsapp/setor";
export interface EntradaTransferir {
  usuario: { id: string; papeis: Papel[] };
  atendimento: { finalidade: Setor; responsavelId: string | null; encerrado: boolean; linhaComercial?: boolean; donoLinhaId?: string | null };
  setoresDoNumero: Setor[];
  ariaPodeDevolver: boolean;
  grupo?: boolean;
}
export interface OpcoesTransferir { visivel: boolean; pessoas: boolean; setores: Setor[]; filaDoSetor: Setor | null; aria: boolean }
export function opcoesTransferir(e: EntradaTransferir): OpcoesTransferir {
  if (e.grupo || e.atendimento.encerrado) return { visivel: false, pessoas: false, setores: [], filaDoSetor: null, aria: false };
  const ctx = { setor: e.atendimento.finalidade, responsavelId: e.atendimento.responsavelId, linhaComercial: e.atendimento.linhaComercial, donoLinhaId: e.atendimento.donoLinhaId };
  const pessoas = podeExecutar(e.usuario, "atribuir", ctx);
  const setores = podeExecutar(e.usuario, "transferir", ctx) ? [...new Set(e.setoresDoNumero)].filter(s => s !== ctx.setor) : [];
  const filaDoSetor = ctx.responsavelId !== null && podeExecutar(e.usuario, "devolver", ctx) ? ctx.setor : null;
  const aria = e.ariaPodeDevolver;
  return { visivel: pessoas || setores.length > 0 || filaDoSetor !== null || aria, pessoas, setores, filaDoSetor, aria };
}
