import { Papel, type EtapaLead, type Prisma } from "@prisma/client";
import { escopoComercialAtual } from "@/server/_shared/escopo-comercial";
import { ErroPermissao, ErroRegra, exigirPapel, registrarEvento, type UsuarioSessao } from "@/server/_shared";
import { destinoDoArraste } from "./etapas";

const MOTIVO_ACAO = {
  marcarPerdido: "Use “Marcar perdida”.",
  prepararContratacao: "Use “Preparar contratação”.",
  enviarProposta: "Use “Enviar proposta”.",
  agendarExperimental: "Use “Agendar experimental”.",
} as const;

/**
 * Move a etapa pela máquina de estados do funil (`destinoDoArraste`), dentro da transação do chamador.
 * Trava a linha ("SELECT … FOR UPDATE") antes de ler a etapa, para que dois movimentos concorrentes
 * não gravem `de` desatualizado. Fica fora de "use server" de propósito: recebe `tx`.
 */
export async function moverEtapaTx(tx: Prisma.TransactionClient, autor: UsuarioSessao, id: string, etapa: EtapaLead): Promise<void> {
  exigirPapel(autor, Papel.VENDEDOR, Papel.GERENTE_COMERCIAL);
  const visivel = await tx.oportunidade.findFirst({ where: { AND: [{ id }, await escopoComercialAtual(autor, tx)] }, select: { id: true } });
  if (!visivel) throw new ErroPermissao("Oportunidade fora da sua carteira.");
  await tx.$queryRaw`SELECT id FROM "Lead" WHERE id = ${id} FOR UPDATE`;
  const lead = await tx.oportunidade.findUniqueOrThrow({ where: { id }, select: { etapa: true } });
  const destino = destinoDoArraste(lead.etapa, etapa);
  if (destino.tipo === "nenhum") return;
  if (destino.tipo === "recusar") throw new ErroRegra(destino.motivo);
  if (destino.tipo === "acao") throw new ErroRegra(MOTIVO_ACAO[destino.acao]);
  await tx.oportunidade.update({ where: { id }, data: { etapa } });
  await registrarEvento(tx, {
    tipo: "EtapaAlterada",
    agregadoTipo: "Lead",
    agregadoId: id,
    autorId: autor.id,
    payload: { de: lead.etapa, para: etapa, origem: "manual" },
  });
}
