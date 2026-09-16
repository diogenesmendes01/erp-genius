import { prisma } from "@/lib/prisma";
import { criarUsuario } from "./integracao";
import { hashSubstituicao } from "@/server/contratos/substituicao-estado";

/** Fonte sintética para testes de fluxos financeiros já existentes. */
export async function seedRelatoOfertaConfirmado(matriculaId: string, inicio: string, fim: string | null) {
  const autor = await criarUsuario(["SECRETARIA_ACADEMICA"]);
  const gestor = await criarUsuario(["GERENTE_PEDAGOGICO"]);
  const dados = { matriculaId, inicio, fim, motivo: "Indisponibilidade sintética documentada", evidenciaTexto: "Fonte acadêmica conferida para o teste financeiro", chaveIdempotencia: `fonte-${autor.id}` };
  const relato = await prisma.registroIndisponibilidadeOfertaMatricula.create({ data: {
    ...dados, inicio: new Date(`${inicio}T00:00:00Z`), fim: fim ? new Date(`${fim}T00:00:00Z`) : null,
    autorId: autor.id, entradaHash: hashSubstituicao(dados),
  } });
  const decisao = { registroId: relato.id, confirmada: true, motivo: "Fonte conferida independentemente", evidenciaTexto: "Confirmação da indisponibilidade no teste" };
  await prisma.confirmacaoIndisponibilidadeOfertaMatricula.create({ data: { ...decisao, confirmadorId: gestor.id, entradaHash: hashSubstituicao(decisao) } });
  return { relato, autor, gestor };
}
