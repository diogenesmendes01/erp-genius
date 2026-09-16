import { randomUUID } from "node:crypto";
import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ErroPermissao, ErroRegra, executarAcao, exigirSessaoComPapel, registrarEvento } from "@/server/_shared";
import { verificarDisponibilidadeGravacaoDrive } from "@/server/gravacoes/disponibilidade";
import { exigirSessaoPortalAluno } from "./sessao";
import { obterDriveOrganizacaoId } from "@/server/gravacoes/credenciais";
import { autorizarReproducaoGravacaoTx } from "@/server/gravacoes/autorizacao";

const texto = z.string().trim().min(5).max(4_000);
const instanteUtc = (valor: Date) => Prisma.sql`${valor}::timestamptz AT TIME ZONE 'UTC'`;

type JanelaEntrega = {
  reposicaoId: string;
  matriculaId: string;
  alunoId: string;
  modalidade: "PARTICULAR" | "GRAVACAO";
  autorizada: boolean;
  statusMatricula: string;
  prazoInicialAte: Date | null;
  materialDisponivel: boolean;
  interrupcaoAtivaDesde: Date | null;
  liberadaAte: Date | null;
};

/** A autorização é o marco a partir do qual a prorrogação passa a valer.
 * Pausas fechadas antes dela já foram consideradas ao gestor escolher o novo
 * prazo; as posteriores ainda precisam ser acrescidas. */
export type ProrrogacaoPrazoEtapa = {
  novoPrazo: Date;
  autorizadaEm: Date;
  versao: number;
};

/** A indisponibilidade em curso suspende a entrega; intervalos encerrados
 * somam tempo ao prazo originalmente publicado. */
export function prazoEntregaVigente(
  prazoInicialAte: Date | null,
  interrupcoesEncerradas: Array<{ inicio: Date; fim: Date | null }>,
  prorrogacoes: ProrrogacaoPrazoEtapa[] = [],
): Date | null {
  if (!prazoInicialAte) return null;
  // Uma nova prorrogação é um retrato autorizado do prazo vigente. Portanto
  // pausas anteriores à última autorização não podem ser somadas outra vez.
  // Uma pausa que a atravessa conta apenas pelo trecho posterior ao marco.
  const ultimaProrrogacao = [...prorrogacoes]
    .filter((item) => item.novoPrazo instanceof Date && item.autorizadaEm instanceof Date)
    .sort((a, b) => a.autorizadaEm.getTime() - b.autorizadaEm.getTime() || a.versao - b.versao)
    .at(-1);
  const marco = ultimaProrrogacao?.autorizadaEm ?? null;
  let retomado = new Date(ultimaProrrogacao?.novoPrazo ?? prazoInicialAte);
  // Converte intervalos fechados em união cronológica. Assim, duas
  // confirmações sobrepostas não contam o mesmo minuto duas vezes. Um relato
  // confirmado após o prazo já vencido continua histórico, mas não ressuscita
  // a possibilidade de entrega.
  const intervalos = interrupcoesEncerradas
    .filter((item): item is { inicio: Date; fim: Date } => !!item.fim && item.fim > item.inicio && (!marco || item.fim > marco))
    .map((item) => ({ inicio: marco && item.inicio < marco ? marco : item.inicio, fim: item.fim }))
    .sort((a, b) => a.inicio.getTime() - b.inicio.getTime());
  const unidos: Array<{ inicio: Date; fim: Date }> = [];
  for (const item of intervalos) {
    const ultimo = unidos.at(-1);
    if (ultimo && item.inicio <= ultimo.fim) {
      if (item.fim > ultimo.fim) ultimo.fim = item.fim;
    } else unidos.push({ ...item });
  }
  for (const item of unidos) {
    if (item.inicio >= retomado) break;
    retomado = new Date(retomado.getTime() + item.fim.getTime() - item.inicio.getTime());
  }
  return retomado;
}

function podeEntregar(janela: JanelaEntrega, prazo: Date | null, agora: Date) {
  if (janela.modalidade !== "GRAVACAO" || !janela.autorizada) throw new ErroRegra("A reposição gravada ainda não está autorizada.");
  if (!janela.materialDisponivel || janela.interrupcaoAtivaDesde) throw new ErroRegra("O material está indisponível e o prazo está pausado.");
  if (!prazo || prazo <= agora) throw new ErroRegra("O prazo desta etapa de entrega está encerrado.");
  if (janela.statusMatricula !== "ATIVA" && (!janela.liberadaAte || janela.liberadaAte <= agora)) {
    throw new ErroRegra("A matrícula exige liberação específica e vigente para esta entrega.");
  }
}

async function janelaEntregaTx(tx: Prisma.TransactionClient, reposicaoId: string, contaId: string, agora: Date) {
  const [janela] = await tx.$queryRaw<JanelaEntrega[]>(Prisma.sql`
    SELECT r.id AS "reposicaoId", r."matriculaId" AS "matriculaId", m."alunoId" AS "alunoId", r.modalidade::text AS modalidade,
      EXISTS (SELECT 1 FROM "DecisaoReposicaoIndividual" d WHERE d."reposicaoId" = r.id AND d.aprovada) AS autorizada,
      m.status::text AS "statusMatricula", disponibilidade."prazoInicialAte" AS "prazoInicialAte",
      COALESCE(material.disponivel, false) AS "materialDisponivel",
      pausa.inicio AS "interrupcaoAtivaDesde",
      liberacao."expiraEm" AS "liberadaAte"
    FROM "ReposicaoIndividual" r
    JOIN "Matricula" m ON m.id = r."matriculaId"
    JOIN "ContaPortalAluno" conta ON conta.id = ${contaId} AND conta."alunoId" = m."alunoId" AND conta.ativa
    LEFT JOIN "MaterialReposicaoGravacao" material ON material."reposicaoId" = r.id
    LEFT JOIN "DisponibilizacaoEntregaReposicao" disponibilidade ON disponibilidade."reposicaoId" = r.id
    LEFT JOIN LATERAL (
      SELECT i.inicio FROM "IndisponibilidadeMaterialReposicao" i
      WHERE i."materialId" = material.id AND i.fim IS NULL
      ORDER BY i.inicio DESC LIMIT 1
    ) pausa ON true
    LEFT JOIN LATERAL (
      SELECT l."expiraEm" FROM "LiberacaoEntregaReposicao" l
      WHERE l."reposicaoId" = r.id AND l."contaId" = ${contaId}
        AND l.inicio <= ${instanteUtc(agora)} AND l."expiraEm" > ${instanteUtc(agora)}
      ORDER BY l."expiraEm" DESC LIMIT 1
    ) liberacao ON true
    WHERE r.id = ${reposicaoId}
    FOR UPDATE OF r, m, conta
  `);
  if (!janela) throw new ErroPermissao("Esta reposição não pertence ao aluno autenticado.");
  const pausas = await tx.$queryRaw<Array<{ inicio: Date; fim: Date | null }>>(Prisma.sql`
    SELECT inicio, fim FROM "IndisponibilidadeMaterialReposicao" i
    JOIN "MaterialReposicaoGravacao" material ON material.id = i."materialId"
    WHERE material."reposicaoId" = ${reposicaoId} AND i.fim IS NOT NULL
  `);
  const prorrogacoes = await tx.$queryRaw<ProrrogacaoPrazoEtapa[]>(Prisma.sql`
    SELECT "novoPrazo" AS "novoPrazo", "criadaEm" AS "autorizadaEm", versao
    FROM "ProrrogacaoPrazoReposicao"
    WHERE "reposicaoId" = ${reposicaoId} AND "solicitacaoCorrecaoId" IS NULL
    ORDER BY "criadaEm", versao
  `);
  return { janela, pausas, prazo: prazoEntregaVigente(janela.prazoInicialAte, pausas, prorrogacoes) };
}

const entregaInput = z.object({ reposicaoId: z.string().min(1), resumo: texto, atividade: texto, evidencia: texto }).strict();

/** Q13/Q33/Q35/Q36/Q52: somente a conta do aluno da matrícula cria a fonte de
 * entrega. A validação docente e a oficialização continuam em outra ação. */
export async function registrarEntregaReposicaoPortalAluno(input: unknown) {
  const sessao = await exigirSessaoPortalAluno();
  const entrada = entregaInput.parse(input);
  return prisma.$transaction(async (tx) => {
    const agora = new Date();
    const { janela, prazo, pausas } = await janelaEntregaTx(tx, entrada.reposicaoId, sessao.contaId, agora);

    const [correcao] = await tx.$queryRaw<Array<{ id: string; prazoAte: Date; criadaEm: Date }>>(Prisma.sql`
      SELECT c.id, c."prazoAte", c."criadaEm"
      FROM "SolicitacaoCorrecaoEntregaReposicao" c
      WHERE c."reposicaoId" = ${janela.reposicaoId} AND c.situacao = 'PENDENTE'
      ORDER BY c."criadaEm" DESC LIMIT 1 FOR UPDATE OF c
    `);
    const prorrogacoesCorrecao = correcao ? await tx.$queryRaw<ProrrogacaoPrazoEtapa[]>(Prisma.sql`
      SELECT "novoPrazo" AS "novoPrazo", "criadaEm" AS "autorizadaEm", versao
      FROM "ProrrogacaoPrazoReposicao"
      WHERE "solicitacaoCorrecaoId" = ${correcao.id}
      ORDER BY "criadaEm", versao
    `) : [];
    const [ultima] = await tx.$queryRaw<Array<{ versao: number }>>(Prisma.sql`
      SELECT versao FROM "EntregaReposicaoGravacao" WHERE "reposicaoId" = ${janela.reposicaoId}
      ORDER BY versao DESC LIMIT 1 FOR UPDATE
    `);
    if (ultima && !correcao) throw new ErroRegra("A entrega anterior aguarda avaliação; não envie outra versão ainda.");
    const prazoEtapa = correcao ? prazoEntregaVigente(correcao.prazoAte,
      pausas.filter(p => p.fim && p.fim > correcao.criadaEm).map(p => ({
        inicio: new Date(Math.max(p.inicio.getTime(), correcao.criadaEm.getTime())), fim: p.fim,
      })), prorrogacoesCorrecao) : prazo;
    podeEntregar(janela, prazoEtapa, agora);
    const id = randomUUID();
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO "EntregaReposicaoGravacao"
        (id, "reposicaoId", "alunoId", "contaPortalAlunoId", "solicitacaoCorrecaoId", versao, resumo, atividade, evidencia, "entregueEm")
      VALUES
        (${id}, ${janela.reposicaoId}, ${janela.alunoId}, ${sessao.contaId}, ${correcao?.id ?? null}, ${(ultima?.versao ?? 0) + 1}, ${entrada.resumo}, ${entrada.atividade}, ${entrada.evidencia}, ${instanteUtc(agora)})
    `);
    if (correcao) await tx.$executeRaw(Prisma.sql`
      UPDATE "SolicitacaoCorrecaoEntregaReposicao" SET situacao = 'RESPONDIDA', "respondidaEm" = ${instanteUtc(agora)}
      WHERE id = ${correcao.id} AND situacao = 'PENDENTE'
    `);
    await registrarEvento(tx, { tipo: "EntregaReposicaoGravacaoRegistradaPeloAluno", agregadoTipo: "Matricula", agregadoId: janela.matriculaId,
      payload: { reposicaoId: janela.reposicaoId, entregaId: id, contaPortalAlunoId: sessao.contaId, versao: (ultima?.versao ?? 0) + 1, correcaoId: correcao?.id ?? null } });
    return { id, entregueEm: agora.toISOString(), prazoAte: prazoEtapa!.toISOString() };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

const publicarMaterial = z.object({ reposicaoId: z.string().min(1), arquivoOficialId: z.string().trim().min(3).max(500).refine((v) => !/^https?:/i.test(v), "Use o identificador do arquivo oficial, não uma URL.").optional(), usarGravacaoAulaOriginal: z.boolean().optional() }).strict()
  .refine(d => d.usarGravacaoAulaOriginal === true ? !d.arquivoOficialId : !!d.arquivoOficialId, "Escolha a gravação da aula ou informe outro arquivo, sem combinar as opções.");

async function fonteDaAulaOriginalTx(tx: Prisma.TransactionClient, reposicaoId: string) {
  const r = await tx.reposicaoIndividual.findUnique({ where: { id: reposicaoId }, select: { aulaOriginalId: true } });
  const e = r ? await tx.encontroAgenda.findUnique({ where: { id: r.aulaOriginalId }, select: { status: true, publicacaoGravacao: true,
    excecoesGravacao: { where: { decisao: { aprovada: true } }, select: { id: true }, take: 1 } } }) : null;
  if (!e || e.status !== "MINISTRADO" || !e.publicacaoGravacao || e.excecoesGravacao.length || e.publicacaoGravacao.driveOrganizacaoId !== obterDriveOrganizacaoId())
    throw new ErroRegra("A aula original não possui gravação oficial disponível para esta publicação.");
  return { publicacaoAulaId: e.publicacaoGravacao.id, arquivoOficialId: e.publicacaoGravacao.arquivoOficialId };
}

type PublicacaoConferida = { matriculaId: string; prazo: number };

/** A primeira conferência não retém lock enquanto o Drive é consultado. A
 * segunda, dentro da transação de escrita, repete integralmente o predicado. */
async function conferirPublicacaoMaterialTx(
  tx: Prisma.TransactionClient,
  autorId: string,
  reposicaoId: string,
  bloquear: boolean,
): Promise<PublicacaoConferida> {
  const lockCompartilhado = bloquear ? Prisma.sql` FOR SHARE` : Prisma.empty;
  const lockExclusivo = bloquear ? Prisma.sql` FOR UPDATE` : Prisma.empty;
  const [fresco] = await tx.$queryRaw<Array<{ ativo: boolean; papeis: Papel[] }>>(Prisma.sql`
    SELECT ativo, papeis FROM "Usuario" WHERE id = ${autorId}${lockCompartilhado}
  `);
  if (!fresco?.ativo || !fresco.papeis.some((p) => p === Papel.SECRETARIA_ACADEMICA || p === Papel.GERENTE_PEDAGOGICO || p === Papel.ADMINISTRADOR)) {
    throw new ErroPermissao();
  }
  const [r] = await tx.$queryRaw<Array<{ matriculaId: string; modalidade: string; autorizada: boolean }>>(Prisma.sql`
    SELECT r."matriculaId" AS "matriculaId", r.modalidade::text AS modalidade,
      EXISTS (SELECT 1 FROM "DecisaoReposicaoIndividual" d WHERE d."reposicaoId" = r.id AND d.aprovada) AS autorizada
    FROM "ReposicaoIndividual" r WHERE r.id = ${reposicaoId}${lockExclusivo}
  `);
  const [configuracao] = await tx.$queryRaw<Array<{ prazoPrimeiraEntregaReposicaoMinutos: number | null }>>(Prisma.sql`
    SELECT "prazoPrimeiraEntregaReposicaoMinutos" FROM "ConfiguracaoOperacional" WHERE id = 'escola'${lockCompartilhado}
  `);
  const prazo = configuracao?.prazoPrimeiraEntregaReposicaoMinutos;
  if (!r || r.modalidade !== "GRAVACAO" || !r.autorizada) throw new ErroRegra("Material exige reposição gravada autorizada.");
  const existente = await tx.materialReposicaoGravacao.findUnique({ where: { reposicaoId }, select: { id: true } });
  if (existente) throw new ErroRegra("Esta reposição já possui material publicado. A publicação original e seu prazo permanecem preservados.");
  if (!Number.isSafeInteger(prazo) || !prazo || prazo < 1) throw new ErroRegra("Configure o prazo da primeira entrega antes de disponibilizar o material.");
  return { matriculaId: r.matriculaId, prazo };
}

/** Registra a fonte oficial; a transmissão autenticada do Drive será um
 * adaptador separado e nunca recebe/expõe uma URL pública neste fluxo. */
export async function publicarMaterialReposicaoGravacao(input: unknown) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO);
    const entrada = publicarMaterial.parse(input);
    // Sem lock e sem escrita: não prolongar uma transação enquanto o provedor
    // externo autentica, consulta metadata e entrega seu primeiro byte.
    const fonte = await prisma.$transaction(async tx => {
      await conferirPublicacaoMaterialTx(tx, autor.id, entrada.reposicaoId, false);
      return entrada.usarGravacaoAulaOriginal ? fonteDaAulaOriginalTx(tx, entrada.reposicaoId) : { publicacaoAulaId: null, arquivoOficialId: entrada.arquivoOficialId! };
    });
    await verificarDisponibilidadeGravacaoDrive(fonte.arquivoOficialId);
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
      const conferida = await conferirPublicacaoMaterialTx(tx, autor.id, entrada.reposicaoId, true);
      if (entrada.usarGravacaoAulaOriginal) {
        const atual = await fonteDaAulaOriginalTx(tx, entrada.reposicaoId);
        if (atual.publicacaoAulaId !== fonte.publicacaoAulaId || atual.arquivoOficialId !== fonte.arquivoOficialId) throw new ErroRegra("A fonte mudou durante a conferência. Consulte novamente.");
      }
      const agora = new Date(), prazoAte = new Date(agora.getTime() + conferida.prazo * 60_000), materialId = randomUUID();
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO "MaterialReposicaoGravacao" (id, "reposicaoId", provedor, "arquivoOficialId", "publicacaoAulaId", disponivel, "publicadoPorId", "publicadoEm")
        VALUES (${materialId}, ${entrada.reposicaoId}, 'GOOGLE_DRIVE', ${fonte.arquivoOficialId}, ${fonte.publicacaoAulaId}, true, ${autor.id}, ${instanteUtc(agora)})
      `);
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO "DisponibilizacaoEntregaReposicao" (id, "reposicaoId", "materialId", "disponibilizadaEm", "prazoBaseMinutos", "prazoInicialAte", "publicadaPorId")
        VALUES (${randomUUID()}, ${entrada.reposicaoId}, ${materialId}, ${instanteUtc(agora)}, ${conferida.prazo}, ${instanteUtc(prazoAte)}, ${autor.id})
      `);
      await registrarEvento(tx, { tipo: "MaterialReposicaoGravacaoDisponibilizado", agregadoTipo: "Matricula", agregadoId: conferida.matriculaId, autorId: autor.id,
        payload: { reposicaoId: entrada.reposicaoId, materialId, publicacaoAulaId: fonte.publicacaoAulaId, provedor: "GOOGLE_DRIVE", prazoAte: prazoAte.toISOString() } });
      return { materialId, prazoAte: prazoAte.toISOString() };
    });
  });
}

const relatoInput = z.object({ reposicaoId: z.string().min(1), descricao: texto }).strict();

/** Q57: o aluno pode relatar falha apenas do próprio material autorizado. O
 * relato não pausa o prazo antes da confirmação da gestão. */
export async function relatarIndisponibilidadeMaterialPortalAluno(input: unknown) {
  const sessao = await exigirSessaoPortalAluno();
  const entrada = relatoInput.parse(input);
  return prisma.$transaction(async (tx) => {
    await autorizarReproducaoGravacaoTx(tx, sessao, entrada.reposicaoId);
    const [material] = await tx.$queryRaw<Array<{ id: string; matriculaId: string }>>(Prisma.sql`
      SELECT material.id, r."matriculaId" AS "matriculaId" FROM "MaterialReposicaoGravacao" material
      JOIN "ReposicaoIndividual" r ON r.id = material."reposicaoId"
      JOIN "Matricula" m ON m.id = r."matriculaId" AND m."alunoId" = ${sessao.alunoId}
      WHERE r.id = ${entrada.reposicaoId} AND material.disponivel
    `);
    if (!material) throw new ErroPermissao("O material não pertence ao aluno autenticado.");
    const id = randomUUID();
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO "RelatoIndisponibilidadeMaterialReposicao" (id, "materialId", "contaPortalAlunoId", descricao)
      VALUES (${id}, ${material.id}, ${sessao.contaId}, ${entrada.descricao})
    `);
    await registrarEvento(tx, { tipo: "IndisponibilidadeMaterialReposicaoRelatada", agregadoTipo: "Matricula", agregadoId: material.matriculaId,
      payload: { relatoId: id, reposicaoId: entrada.reposicaoId, contaPortalAlunoId: sessao.contaId } });
    return { id };
  });
}

async function exigirGestaoFresca(tx: Prisma.TransactionClient, usuarioId: string) {
  const [usuario] = await tx.$queryRaw<Array<{ ativo: boolean; papeis: Papel[] }>>(Prisma.sql`SELECT ativo, papeis FROM "Usuario" WHERE id = ${usuarioId} FOR SHARE`);
  if (!usuario?.ativo || !usuario.papeis.some((p) => p === Papel.GERENTE_PEDAGOGICO || p === Papel.ADMINISTRADOR)) throw new ErroPermissao();
}

const confirmarIndisponibilidade = z.object({ relatoId: z.string().min(1), motivo: texto }).strict();
export async function confirmarIndisponibilidadeMaterialReposicao(input: unknown) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO);
    const entrada = confirmarIndisponibilidade.parse(input);
    return prisma.$transaction(async (tx) => {
      await exigirGestaoFresca(tx, autor.id);
      const [relato] = await tx.$queryRaw<Array<{ materialId: string; reposicaoId: string; matriculaId: string }>>(Prisma.sql`
        SELECT relato."materialId" AS "materialId", material."reposicaoId" AS "reposicaoId", r."matriculaId" AS "matriculaId"
        FROM "RelatoIndisponibilidadeMaterialReposicao" relato
        JOIN "MaterialReposicaoGravacao" material ON material.id = relato."materialId"
        JOIN "ReposicaoIndividual" r ON r.id = material."reposicaoId"
        WHERE relato.id = ${entrada.relatoId} AND relato.situacao = 'ABERTO' FOR UPDATE OF relato, material, r
      `);
      if (!relato) throw new ErroRegra("Relato indisponível para confirmação.");
      const id = randomUUID(), agora = new Date();
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO "IndisponibilidadeMaterialReposicao" (id, "materialId", "relatoId", "confirmadaPorId", inicio, motivo)
        VALUES (${id}, ${relato.materialId}, ${entrada.relatoId}, ${autor.id}, ${instanteUtc(agora)}, ${entrada.motivo})
      `);
      await tx.$executeRaw(Prisma.sql`UPDATE "RelatoIndisponibilidadeMaterialReposicao" SET situacao = 'CONFIRMADO', "confirmadoEm" = ${instanteUtc(agora)} WHERE id = ${entrada.relatoId}`);
      await registrarEvento(tx, { tipo: "IndisponibilidadeMaterialReposicaoConfirmada", agregadoTipo: "Matricula", agregadoId: relato.matriculaId, autorId: autor.id,
        payload: { reposicaoId: relato.reposicaoId, relatoId: entrada.relatoId, indisponibilidadeId: id } });
      return { id };
    });
  });
}

const retomarIndisponibilidade = z.object({ indisponibilidadeId: z.string().min(1), motivo: texto }).strict();
async function conferirRetomadaMaterialTx(tx: Prisma.TransactionClient, usuarioId: string, indisponibilidadeId: string) {
  await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`);
  await exigirGestaoFresca(tx, usuarioId);
  const [pausa] = await tx.$queryRaw<Array<{
    reposicaoId: string; matriculaId: string; materialId: string; aulaOriginalId: string;
    arquivoOficialId: string; publicacaoAulaId: string | null; inicio: Date;
  }>>(Prisma.sql`
    SELECT material."reposicaoId", r."matriculaId", material.id AS "materialId", r."aulaOriginalId",
      material."arquivoOficialId", material."publicacaoAulaId", i.inicio
    FROM "IndisponibilidadeMaterialReposicao" i
    JOIN "MaterialReposicaoGravacao" material ON material.id = i."materialId"
    JOIN "ReposicaoIndividual" r ON r.id = material."reposicaoId"
    WHERE i.id = ${indisponibilidadeId} AND i.fim IS NULL
      AND material.disponivel AND material.provedor = 'GOOGLE_DRIVE'
    FOR UPDATE OF i, material, r
  `);
  if (!pausa) throw new ErroRegra("Indisponibilidade não está em curso com material publicado.");
  const driveId = obterDriveOrganizacaoId();
  if (pausa.publicacaoAulaId) {
    const publicacao = await tx.publicacaoGravacaoAula.findUnique({ where: { id: pausa.publicacaoAulaId } });
    if (!publicacao || publicacao.encontroId !== pausa.aulaOriginalId ||
        publicacao.arquivoOficialId !== pausa.arquivoOficialId || publicacao.driveOrganizacaoId !== driveId) {
      throw new ErroRegra("A fonte oficial mudou; confira o material antes de retomar.");
    }
  }
  return { ...pausa, driveId };
}

export async function retomarMaterialReposicaoGravacao(input: unknown) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO);
    const entrada = retomarIndisponibilidade.parse(input);
    const conferida = await prisma.$transaction((tx) => conferirRetomadaMaterialTx(tx, autor.id, entrada.indisponibilidadeId));
    await verificarDisponibilidadeGravacaoDrive(conferida.arquivoOficialId, { obterDriveId: () => conferida.driveId });
    return prisma.$transaction(async (tx) => {
      const pausa = await conferirRetomadaMaterialTx(tx, autor.id, entrada.indisponibilidadeId);
      if (JSON.stringify(pausa) !== JSON.stringify(conferida)) throw new ErroRegra("O material mudou durante a conferência; confira novamente.");
      const agora = new Date();
      await tx.$executeRaw(Prisma.sql`UPDATE "IndisponibilidadeMaterialReposicao" SET fim = ${instanteUtc(agora)}, motivo = motivo || E'\nRetomada: ' || ${entrada.motivo} WHERE id = ${entrada.indisponibilidadeId} AND fim IS NULL`);
      await registrarEvento(tx, { tipo: "MaterialReposicaoGravacaoRetomado", agregadoTipo: "Matricula", agregadoId: pausa.matriculaId, autorId: autor.id,
        payload: { reposicaoId: pausa.reposicaoId, indisponibilidadeId: entrada.indisponibilidadeId,
          materialId: pausa.materialId, publicacaoAulaId: pausa.publicacaoAulaId, disponibilidadeConferida: true } });
      return { retomadaEm: agora.toISOString() };
    });
  });
}

const prorrogacao = z.object({ reposicaoId: z.string().min(1), solicitacaoCorrecaoId: z.string().min(1).nullable().optional(), prazoAnterior: z.string().datetime(), novoPrazo: z.string().datetime(), motivo: texto }).strict();
export async function prorrogarPrazoEntregaReposicao(input: unknown) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO);
    const entrada = prorrogacao.parse(input), anterior = new Date(entrada.prazoAnterior), novo = new Date(entrada.novoPrazo);
    return prisma.$transaction(async (tx) => {
      await exigirGestaoFresca(tx, autor.id);
      const [r] = await tx.$queryRaw<Array<{ matriculaId: string }>>(Prisma.sql`SELECT "matriculaId" AS "matriculaId" FROM "ReposicaoIndividual" WHERE id = ${entrada.reposicaoId} FOR UPDATE`);
      if (!r || novo <= anterior || novo <= new Date()) throw new ErroRegra("A prorrogação precisa definir novo prazo futuro e posterior ao vigente.");
      const [fonte] = entrada.solicitacaoCorrecaoId
        ? await tx.$queryRaw<Array<{ prazoAte: Date; inicioEtapa: Date }>>(Prisma.sql`SELECT "prazoAte", "criadaEm" AS "inicioEtapa" FROM "SolicitacaoCorrecaoEntregaReposicao" WHERE id = ${entrada.solicitacaoCorrecaoId} AND "reposicaoId" = ${entrada.reposicaoId} AND situacao = 'PENDENTE' FOR UPDATE`)
        : await tx.$queryRaw<Array<{ prazoAte: Date; inicioEtapa: Date }>>(Prisma.sql`
            SELECT disponibilidade."prazoInicialAte" AS "prazoAte", disponibilidade."disponibilizadaEm" AS "inicioEtapa"
            FROM "DisponibilizacaoEntregaReposicao" disponibilidade
            WHERE disponibilidade."reposicaoId" = ${entrada.reposicaoId} FOR UPDATE
          `);
      const pausas = await tx.$queryRaw<Array<{ inicio: Date; fim: Date }>>(Prisma.sql`
        SELECT i.inicio, i.fim FROM "IndisponibilidadeMaterialReposicao" i
        JOIN "MaterialReposicaoGravacao" material ON material.id=i."materialId"
        WHERE material."reposicaoId"=${entrada.reposicaoId} AND i.fim IS NOT NULL
      `);
      const prorrogacoesEtapa = await tx.$queryRaw<ProrrogacaoPrazoEtapa[]>(Prisma.sql`
        SELECT "novoPrazo" AS "novoPrazo", "criadaEm" AS "autorizadaEm", versao FROM "ProrrogacaoPrazoReposicao"
        WHERE "reposicaoId" = ${entrada.reposicaoId} AND "solicitacaoCorrecaoId" IS NOT DISTINCT FROM ${entrada.solicitacaoCorrecaoId ?? null}
        ORDER BY "criadaEm", versao FOR UPDATE
      `);
      const ultima = prorrogacoesEtapa.at(-1);
      const vigente = fonte ? prazoEntregaVigente(fonte.prazoAte,
        pausas.filter(p => p.fim > fonte.inicioEtapa).map(p => ({
          inicio: new Date(Math.max(p.inicio.getTime(), fonte.inicioEtapa.getTime())), fim: p.fim,
        })), prorrogacoesEtapa) : null;
      if (!vigente || vigente.getTime() !== anterior.getTime()) throw new ErroRegra("O prazo mudou; confira antes de prorrogar.");
      const id = randomUUID();
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO "ProrrogacaoPrazoReposicao" (id, "reposicaoId", "solicitacaoCorrecaoId", versao, "prazoAnterior", "novoPrazo", motivo, "autorizadaPorId")
        VALUES (${id}, ${entrada.reposicaoId}, ${entrada.solicitacaoCorrecaoId ?? null}, ${(ultima?.versao ?? 0) + 1}, ${instanteUtc(anterior)}, ${instanteUtc(novo)}, ${entrada.motivo}, ${autor.id})
      `);
      await registrarEvento(tx, { tipo: "PrazoEntregaReposicaoProrrogado", agregadoTipo: "Matricula", agregadoId: r.matriculaId, autorId: autor.id,
        payload: { reposicaoId: entrada.reposicaoId, solicitacaoCorrecaoId: entrada.solicitacaoCorrecaoId ?? null, prorrogacaoId: id, novoPrazo: novo.toISOString() } });
      return { id, novoPrazo: novo.toISOString() };
    });
  });
}

const liberacao = z.object({ reposicaoId: z.string().min(1), contaId: z.string().min(1), expiraEm: z.string().datetime(), motivo: texto }).strict();
export async function liberarEntregaReposicaoPausada(input: unknown) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO);
    const entrada = liberacao.parse(input), agora = new Date(), expiraEm = new Date(entrada.expiraEm);
    return prisma.$transaction(async (tx) => {
      await exigirGestaoFresca(tx, autor.id);
      const [r] = await tx.$queryRaw<Array<{ matriculaId: string; status: string }>>(Prisma.sql`
        SELECT r."matriculaId" AS "matriculaId", m.status::text AS status FROM "ReposicaoIndividual" r JOIN "Matricula" m ON m.id = r."matriculaId"
        JOIN "ContaPortalAluno" c ON c.id = ${entrada.contaId} AND c."alunoId" = m."alunoId" AND c.ativa
        WHERE r.id = ${entrada.reposicaoId} AND r.modalidade = 'GRAVACAO'
          AND EXISTS (SELECT 1 FROM "DecisaoReposicaoIndividual" d WHERE d."reposicaoId" = r.id AND d.aprovada)
        FOR UPDATE OF r, m, c
      `);
      if (!r || !["PAUSADA", "ENCERRADA"].includes(r.status) || expiraEm <= agora) throw new ErroRegra("A liberação específica exige reposição gravada autorizada, conta ativa, matrícula pausada ou encerrada e prazo futuro.");
      const id = randomUUID();
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO "LiberacaoEntregaReposicao" (id, "reposicaoId", "contaId", inicio, "expiraEm", motivo, "autorizadaPorId")
        VALUES (${id}, ${entrada.reposicaoId}, ${entrada.contaId}, ${instanteUtc(agora)}, ${instanteUtc(expiraEm)}, ${entrada.motivo}, ${autor.id})
      `);
      await registrarEvento(tx, { tipo: "EntregaReposicaoPausadaLiberada", agregadoTipo: "Matricula", agregadoId: r.matriculaId, autorId: autor.id,
        payload: { reposicaoId: entrada.reposicaoId, contaPortalAlunoId: entrada.contaId, liberacaoId: id, expiraEm: expiraEm.toISOString() } });
      return { id, expiraEm: expiraEm.toISOString() };
    });
  });
}
