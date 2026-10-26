import type { Prisma } from "@prisma/client";
import { ErroRegra } from "@/server/_shared/sessao";
import { registrarEvento } from "@/server/_shared/evento";

/** Uso interno: witness de Contato inserido pela MESMA tx; nunca recebe identidade de um endpoint. */
export async function criarPessoaDoContatoNovoTx(
 tx: Prisma.TransactionClient,
 contatoCriadoNaTx: { id: string; telefoneE164: string },
 entrada: { nome: string; autorId: string },
): Promise<{ pessoaId: string }> {
 const contato = await tx.contatoWhatsApp.findUnique({
  where: { id: contatoCriadoNaTx.id },
  select: { id: true, telefoneE164: true, pessoaId: true, alunoId: true, responsavelId: true, leadId: true },
 });
 if (!contato || contato.id !== contatoCriadoNaTx.id || contato.telefoneE164 !== contatoCriadoNaTx.telefoneE164 || contato.pessoaId !== null || contato.alunoId !== null || contato.responsavelId !== null || contato.leadId !== null) {
  throw new ErroRegra("O cadastro mudou. Confira a conversa antes de repetir.");
 }
 const pessoa = await tx.pessoa.create({ data: { nome: entrada.nome, email: null, origemCanal: "PROSPECCAO_ATIVA" } });
 await registrarEvento(tx, {
  tipo: "PessoaCriada", agregadoTipo: "Pessoa", agregadoId: pessoa.id, autorId: entrada.autorId,
  payload: { nome: entrada.nome, origemCanal: "PROSPECCAO_ATIVA", vinculo: null },
 });
 const vinculo = await tx.contatoWhatsApp.updateMany({
  where: { id: contatoCriadoNaTx.id, telefoneE164: contatoCriadoNaTx.telefoneE164, pessoaId: null, alunoId: null, responsavelId: null, leadId: null },
  data: { pessoaId: pessoa.id },
 });
 if (vinculo.count !== 1) throw new ErroRegra("O cadastro mudou. Confira a conversa antes de repetir.");
 return { pessoaId: pessoa.id };
}
