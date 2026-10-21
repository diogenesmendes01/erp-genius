import { Prisma } from "@prisma/client";
import { bloquearFontePropostaTx } from "./fonte-contratual-tx";
import { z } from "zod";
import { ErroPermissao, ErroRegra, registrarEvento } from "@/server/_shared";
import { carregarBaseAditivoTx } from "./aditivo-estado";
import { AlcadaAditivoSchema, alcadasAplicaveisAditivo, type AlcadaAditivo } from "./aditivo-alcadas-regras";
import { hashSubstituicao } from "./substituicao-estado";

const json = (valor: unknown): Prisma.InputJsonObject => JSON.parse(JSON.stringify(valor));
function podeDecidir(ator: { ativo: boolean; papeis: string[]; permissoes: string[] }, alcada: AlcadaAditivo) {
  if (!ator.ativo) return false;
  if (ator.papeis.includes("ADMINISTRADOR")) return true;
  return alcada === "FINANCEIRA" ? ator.papeis.includes("FINANCEIRO") && ator.permissoes.includes("financeiro.aprovar_acertos")
    : alcada === "COMERCIAL" ? ator.papeis.includes("GERENTE_COMERCIAL") : ator.papeis.includes("GERENTE_PEDAGOGICO");
}

export async function exigirAlcadasAditivoTx(tx: Prisma.TransactionClient, proposta: { id: string; entradaHash: string; snapshot: Prisma.JsonValue }) {
  const alteracoes = (proposta.snapshot as { alteracoes?: unknown }).alteracoes;
  const exigidas = alcadasAplicaveisAditivo(alteracoes);
  const decisoes = await tx.decisaoAlcadaAditivo.findMany({ where: { propostaId: proposta.id }, select: { alcada: true, aprovada: true, propostaHash: true } });
  if (exigidas.some(alcada => !decisoes.some(d => d.alcada === alcada && d.aprovada && d.propostaHash === proposta.entradaHash))) throw new ErroRegra("As alçadas específicas aplicáveis ainda precisam aprovar este aditivo.");
}

export async function decidirAlcadaAditivoTx(tx: Prisma.TransactionClient, autorId: string, entrada: unknown) {
  const d = zEntrada.parse(entrada);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
  const p = await tx.propostaAditivoContratual.findFirst({ where: { id: d.propostaId, matriculaId: d.matriculaId }, include: { decisao: true } });
  if (!p) throw new ErroRegra("Proposta indisponível nesta matrícula.");
  await tx.$queryRaw`SELECT id FROM "Matricula" WHERE id = ${p.matriculaId} FOR UPDATE`;
  await bloquearFontePropostaTx(tx, p);
  await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id = ${autorId} FOR SHARE`;
  const ator = await tx.usuario.findUnique({ where: { id: autorId }, select: { ativo: true, papeis: true, permissoes: true } });
  if (!ator || !podeDecidir(ator, d.alcada)) throw new ErroPermissao();
  if (autorId === p.preparadaPorId) throw new ErroRegra("A pessoa que preparou o aditivo não pode aprovar sua própria alçada.");
  if (!p.decisao?.aprovada || p.decisao.propostaHash !== p.entradaHash || p.entradaHash !== d.propostaHash || hashSubstituicao(p.snapshot) !== p.entradaHash) throw new ErroRegra("A aprovação administrativa e a proposta revisada são obrigatórias.");
  if (await tx.propostaAditivoContratual.count({ where: { matriculaId: p.matriculaId, versao: { gt: p.versao } } })) throw new ErroRegra("Existe proposta de aditivo mais recente.");
  const s = p.snapshot as Prisma.JsonObject, contexto = await carregarBaseAditivoTx(tx, s.entrada, p.versao);
  const esperado = json({ ...contexto, versao: p.versao, preparadaPorId: p.preparadaPorId, motivo: p.motivo, entrada: s.entrada });
  if (hashSubstituicao(esperado as Prisma.JsonObject) !== p.entradaHash) throw new ErroRegra("A base do aditivo mudou. Prepare uma nova proposta.");
  if (!alcadasAplicaveisAditivo(s.alteracoes).includes(d.alcada)) throw new ErroRegra("Esta alçada não se aplica às alterações da proposta.");
  const anterior = await tx.decisaoAlcadaAditivo.findUnique({ where: { propostaId_alcada: { propostaId: p.id, alcada: d.alcada } } });
  if (anterior) {
    if (anterior.decisorId !== autorId || anterior.aprovada !== d.aprovada || anterior.motivo !== d.motivo || anterior.propostaHash !== p.entradaHash) throw new ErroRegra("Esta alçada já recebeu outra decisão.");
    return { id: anterior.id, alcada: anterior.alcada, aprovada: anterior.aprovada };
  }
  const decisao = await tx.decisaoAlcadaAditivo.create({ data: { propostaId: p.id, decisorId: autorId, alcada: d.alcada, aprovada: d.aprovada, motivo: d.motivo, propostaHash: p.entradaHash } });
  await registrarEvento(tx, { tipo: "AlcadaAditivoDecidida", agregadoTipo: "Matricula", agregadoId: p.matriculaId, autorId, payload: { propostaId: p.id, alcada: d.alcada, aprovada: d.aprovada } });
  return { id: decisao.id, alcada: decisao.alcada, aprovada: decisao.aprovada };
}
const zEntrada = z.object({ matriculaId: z.string().min(1), propostaId: z.string().min(1), propostaHash: z.string().regex(/^[a-f0-9]{64}$/), alcada: AlcadaAditivoSchema, aprovada: z.boolean(), motivo: z.string().trim().min(5).max(2000) }).strict();
