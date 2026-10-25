"use client";
import { transferirPessoaInbox, transferirSetorInbox } from "@/server/whatsapp/transferencia-inbox";
import { devolverParaFila } from "@/server/whatsapp/acoes-atendimento";
import { devolverParaAria } from "@/server/aria/acoes";
import { listarPessoasParaAtendimento, temResumoDaAria } from "@/server/whatsapp/consultas-acoes-atendimento";
import type { Resultado } from "@/server/_shared/resultado";
import type { ComandoTransferirInbox } from "./useTransferirConversa";
export async function carregarPessoasTransferir(id: string) { return listarPessoasParaAtendimento(id, "atribuir"); }
export async function carregarResumoTransferir(id: string) { return temResumoDaAria(id); }
export async function executarTransferenciaInbox(comando: ComandoTransferirInbox): Promise<Resultado> {
  const { atendimentoId, contexto, chaveIdempotencia, alvo } = comando;
  if (alvo.tipo === "pessoa") return transferirPessoaInbox({ atendimentoId, usuarioId: alvo.usuarioId, contexto, chaveIdempotencia });
  if (alvo.tipo === "fila") return devolverParaFila(atendimentoId);
  if (alvo.tipo === "aria") return devolverParaAria(atendimentoId);
  const r = await transferirSetorInbox({ atendimentoId, destino: alvo.setor, destinoChave: alvo.destinoChave, contexto, anexarResumoAria: comando.anexarResumoAria === true, chaveIdempotencia });
  return r.ok ? { ok: true } : r;
}
