import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  ErroPermissao,
  ErroRegra,
  executarAcao,
  exigirSessaoComPapel,
  registrarEvento,
} from "@/server/_shared";
import { limparFalhasLoginPortal, loginPortalBloqueadoTx, registrarFalhaLoginPortal } from "./rate-limit";
import {
  digestSegredoPortalAluno,
  caminhoAtivacaoPortalAluno,
  exigirPrazosPortalAluno,
  gerarSegredoPortalAluno,
  normalizarEmailPortalAluno,
  type PrazosPortalAluno,
} from "./politica";
import { criarSessaoPortalAlunoTx } from "./sessao";

const instanteUtc = (valor: Date) => Prisma.sql`${valor}::timestamptz AT TIME ZONE 'UTC'`;
const texto = z.string().trim().min(5).max(4000);
const senha = z.string().min(12, "Use ao menos 12 caracteres na senha.").max(128)
  .refine((valor) => Buffer.byteLength(valor, "utf8") <= 72, "A senha ultrapassa o limite seguro de 72 bytes.");

type ConfiguracaoPrazos = {
  prazoSessaoPortalAlunoMinutos: number | null;
  prazoConvitePortalAlunoMinutos: number | null;
  prazoRecuperacaoPortalAlunoMinutos: number | null;
  prazoValidacaoEmailPortalAlunoMinutos: number | null;
};

type ContaLinha = {
  id: string;
  alunoId: string;
  emailVerificado: string | null;
  senhaHash: string | null;
  versaoSessao: number;
  ativa: boolean;
  emailAluno: string | null;
};

async function prazosPortalAlunoTx(tx: Prisma.TransactionClient): Promise<PrazosPortalAluno> {
  const [configuracao] = await tx.$queryRaw<ConfiguracaoPrazos[]>(Prisma.sql`
    SELECT "prazoSessaoPortalAlunoMinutos", "prazoConvitePortalAlunoMinutos",
      "prazoRecuperacaoPortalAlunoMinutos", "prazoValidacaoEmailPortalAlunoMinutos"
    FROM "ConfiguracaoOperacional" WHERE id = 'escola'
  `);
  try {
    return exigirPrazosPortalAluno(configuracao ?? {
      prazoSessaoPortalAlunoMinutos: null,
      prazoConvitePortalAlunoMinutos: null,
      prazoRecuperacaoPortalAlunoMinutos: null,
      prazoValidacaoEmailPortalAlunoMinutos: null,
    });
  } catch {
    throw new ErroRegra("Configure todos os prazos do portal do aluno antes de emitir links ou sessões.");
  }
}

async function obterOuCriarContaTx(tx: Prisma.TransactionClient, alunoId: string): Promise<ContaLinha> {
  const [aluno] = await tx.$queryRaw<{ id: string; email: string | null }[]>(Prisma.sql`
    SELECT id, email FROM "Aluno" WHERE id = ${alunoId} FOR UPDATE
  `);
  if (!aluno) throw new ErroRegra("Aluno não encontrado.");
  const [existente] = await tx.$queryRaw<ContaLinha[]>(Prisma.sql`
    SELECT c.id, c."alunoId" AS "alunoId", c."emailVerificado" AS "emailVerificado",
      c."senhaHash" AS "senhaHash", c."versaoSessao" AS "versaoSessao", c.ativa,
      ${aluno.email}::text AS "emailAluno"
    FROM "ContaPortalAluno" c WHERE c."alunoId" = ${aluno.id} FOR UPDATE
  `);
  if (existente) return existente;
  const id = randomUUID();
  await tx.$executeRaw(Prisma.sql`
    INSERT INTO "ContaPortalAluno" (id, "alunoId") VALUES (${id}, ${aluno.id})
  `);
  return { id, alunoId: aluno.id, emailVerificado: null, senhaHash: null, versaoSessao: 1, ativa: true, emailAluno: aluno.email };
}

async function exigirFuncionarioAtualTx(tx: Prisma.TransactionClient, usuarioId: string, ...papeis: Papel[]) {
  const [usuario] = await tx.$queryRaw<{ ativo: boolean; papeis: Papel[] }[]>(Prisma.sql`
    SELECT ativo, papeis FROM "Usuario" WHERE id = ${usuarioId} FOR SHARE
  `);
  if (!usuario?.ativo) throw new ErroPermissao("Sua sessão não está mais ativa.");
  if (!usuario.papeis.includes(Papel.ADMINISTRADOR) && !usuario.papeis.some((papel) => papeis.includes(papel))) {
    throw new ErroPermissao("Sua permissão mudou; inicie a operação novamente.");
  }
}

async function criarEnvioPendenteTx(
  tx: Prisma.TransactionClient,
  entrada: { contaId: string; finalidade: "CONVITE" | "RECUPERACAO" | "VALIDAR_TROCA_EMAIL"; destinatario: string; trocaEmailId?: string },
) {
  const [existente] = await tx.$queryRaw<{ id: string; situacao: string }[]>(Prisma.sql`
    SELECT id, situacao::text AS situacao FROM "SolicitacaoEnvioPortalAluno"
    WHERE "contaId" = ${entrada.contaId}
      AND finalidade = ${entrada.finalidade}::"FinalidadeTokenPortalAluno"
      AND destinatario = ${entrada.destinatario}
      AND "trocaEmailId" IS NOT DISTINCT FROM ${entrada.trocaEmailId ?? null}
      AND situacao = 'PREPARADO'
    ORDER BY "criadoEm" DESC LIMIT 1 FOR UPDATE
  `);
  if (existente) return { id: existente.id, situacao: existente.situacao as "PREPARADO" };
  const id = randomUUID();
  await tx.$executeRaw(Prisma.sql`
    INSERT INTO "SolicitacaoEnvioPortalAluno"
      (id, "contaId", finalidade, destinatario, "trocaEmailId", situacao, chave)
    VALUES
      (${id}, ${entrada.contaId}, ${entrada.finalidade}::"FinalidadeTokenPortalAluno",
       ${entrada.destinatario}, ${entrada.trocaEmailId ?? null}, 'PREPARADO', ${`portal:${entrada.finalidade}:${id}`})
  `);
  return { id, situacao: "PREPARADO" as const };
}

/**
 * Q72/Q73. Só prepara uma intenção rastreável: não retorna token, senha ou
 * link. O despachante interno é o único componente que materializa o token
 * quando Resend, domínio e remetente estiverem efetivamente configurados.
 */
export async function prepararConvitePortalAluno(input: { alunoId: string }) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA, Papel.ADMINISTRADOR);
    const dados = z.object({ alunoId: z.string().min(1) }).strict().parse(input);
    return prisma.$transaction(async (tx) => {
      await exigirFuncionarioAtualTx(tx, autor.id, Papel.SECRETARIA_ACADEMICA, Papel.ADMINISTRADOR);
      const conta = await obterOuCriarContaTx(tx, dados.alunoId);
      if (!conta.ativa) throw new ErroRegra("A conta do aluno está bloqueada.");
      if (conta.senhaHash) throw new ErroRegra("O aluno já possui credencial; use recuperação de acesso quando necessário.");
      if (!conta.emailAluno) {
        await registrarEvento(tx, {
          tipo: "PendenciaAcessoPortalAlunoEmailAusente", agregadoTipo: "Aluno", agregadoId: conta.alunoId, autorId: autor.id,
          payload: { contaId: conta.id },
        });
        return { contaId: conta.id, situacao: "PENDENTE_EMAIL" as const };
      }
      const destinatario = normalizarEmailPortalAluno(conta.emailAluno);
      const envio = await criarEnvioPendenteTx(tx, { contaId: conta.id, finalidade: "CONVITE", destinatario });
      await registrarEvento(tx, {
        tipo: "ConvitePortalAlunoPreparado", agregadoTipo: "Aluno", agregadoId: conta.alunoId, autorId: autor.id,
        payload: { contaId: conta.id, solicitacaoEnvioId: envio.id },
      });
      return { contaId: conta.id, solicitacaoEnvioId: envio.id, situacao: envio.situacao };
    });
  });
}

/** Resposta indistinguível para não revelar se há uma credencial nesse e-mail. */
export async function solicitarRecuperacaoPortalAluno(input: unknown) {
  const dados = z.object({ email: z.string().trim().max(320) }).strict().parse(input);
  let email: string;
  try { email = normalizarEmailPortalAluno(dados.email); }
  catch { return { situacao: "PENDENTE_ENVIO" as const }; }
  await prisma.$transaction(async (tx) => {
    if (await loginPortalBloqueadoTx(tx, `recuperacao:${email}`)) return;
    await registrarFalhaLoginPortal(tx, `recuperacao:${email}`);
    const [conta] = await tx.$queryRaw<ContaLinha[]>(Prisma.sql`
      SELECT id, "alunoId" AS "alunoId", "emailVerificado" AS "emailVerificado",
        "senhaHash" AS "senhaHash", "versaoSessao" AS "versaoSessao", ativa, NULL::text AS "emailAluno"
      FROM "ContaPortalAluno"
      WHERE LOWER("emailVerificado") = ${email}
      FOR UPDATE
    `);
    if (!conta?.ativa || !conta.senhaHash || conta.emailVerificado !== email) return;
    await criarEnvioPendenteTx(tx, { contaId: conta.id, finalidade: "RECUPERACAO", destinatario: email });
  });
  return { situacao: "PENDENTE_ENVIO" as const };
}

export async function entrarPortalAluno(input: unknown) {
  const dados = z.object({ email: z.string().trim().max(320), senha: z.string().min(1).max(128) }).strict().parse(input);
  let email: string;
  try { email = normalizarEmailPortalAluno(dados.email); }
  catch { return { autenticado: false as const }; }
  const resultado = await prisma.$transaction(async (tx) => {
    if (await loginPortalBloqueadoTx(tx, email)) return null;
    const [conta] = await tx.$queryRaw<ContaLinha[]>(Prisma.sql`
      SELECT id, "alunoId" AS "alunoId", "emailVerificado" AS "emailVerificado",
        "senhaHash" AS "senhaHash", "versaoSessao" AS "versaoSessao", ativa, NULL::text AS "emailAluno"
      FROM "ContaPortalAluno"
      WHERE LOWER("emailVerificado") = ${email}
      FOR UPDATE
    `);
    if (!conta?.ativa || !conta.senhaHash || !await bcrypt.compare(dados.senha, conta.senhaHash)) {
      await registrarFalhaLoginPortal(tx, email);
      return null;
    }
    const prazos = await prazosPortalAlunoTx(tx);
    const sessao = await criarSessaoPortalAlunoTx(tx, { contaId: conta.id, versaoConta: conta.versaoSessao, prazos });
    await limparFalhasLoginPortal(tx, email);
    return { conta, sessao };
  });
  if (!resultado) return { autenticado: false as const };
  return { autenticado: true as const, sessaoCookie: resultado.sessao.segredo, expiraEm: resultado.sessao.expiraEm };
}

/** Link recebido pelo aluno. O token bruto entra, mas nunca sai deste servidor. */
export async function consumirTokenPortalAluno(input: unknown) {
  const dados = z.object({ token: z.string().min(32).max(200), senha: senha.optional() }).strict().parse(input);
  const agora = new Date();
  return prisma.$transaction(async (tx) => {
    const digest = digestSegredoPortalAluno(dados.token);
    const [token] = await tx.$queryRaw<{
      id: string; contaId: string; finalidade: "CONVITE" | "RECUPERACAO" | "VALIDAR_TROCA_EMAIL";
      destinatario: string; trocaEmailId: string | null; expiraEm: Date; consumidoEm: Date | null; revogadoEm: Date | null;
      ativa: boolean; versaoSessao: number; emailVerificado: string | null; alunoId: string;
    }[]>(Prisma.sql`
      SELECT t.id, t."contaId" AS "contaId", t.finalidade::text AS finalidade, t.destinatario,
        t."trocaEmailId" AS "trocaEmailId", t."expiraEm" AS "expiraEm", t."consumidoEm" AS "consumidoEm",
        t."revogadoEm" AS "revogadoEm", c.ativa, c."versaoSessao" AS "versaoSessao",
        c."emailVerificado" AS "emailVerificado", c."alunoId" AS "alunoId"
      FROM "TokenPortalAluno" t JOIN "ContaPortalAluno" c ON c.id = t."contaId"
      WHERE t.digest = ${digest} FOR UPDATE OF t, c
    `);
    if (!token || !token.ativa || token.consumidoEm || token.revogadoEm || token.expiraEm <= agora) {
      throw new ErroRegra("Este link não está disponível. Solicite outro acesso.");
    }
    if (token.finalidade === "VALIDAR_TROCA_EMAIL") {
      if (dados.senha || !token.trocaEmailId) throw new ErroRegra("Este link serve somente para validar o novo e-mail.");
      const atualizado = await tx.$executeRaw(Prisma.sql`
        UPDATE "SolicitacaoTrocaEmailPortalAluno"
        SET "novoEmailVerificadoEm" = ${instanteUtc(agora)}, situacao = 'PENDENTE_DECISAO'
        WHERE id = ${token.trocaEmailId} AND situacao = 'PENDENTE_VALIDACAO'
          AND "novoEmail" = ${token.destinatario}
      `);
      if (atualizado !== 1) throw new ErroRegra("A solicitação de troca não está mais disponível.");
      await tx.$executeRaw(Prisma.sql`UPDATE "TokenPortalAluno" SET "consumidoEm" = ${instanteUtc(agora)} WHERE id = ${token.id}`);
      return { tipo: "EMAIL_VALIDADO" as const };
    }
    if (!dados.senha) throw new ErroRegra("Defina uma senha para continuar.");
    if (token.finalidade === "CONVITE" && token.emailVerificado !== null) {
      throw new ErroRegra("Este convite não corresponde ao estado atual da conta.");
    }
    if (token.finalidade === "CONVITE") {
      const [aluno] = await tx.$queryRaw<{ email: string | null }[]>(Prisma.sql`
        SELECT email FROM "Aluno" WHERE id = ${token.alunoId} FOR SHARE
      `);
      if (!aluno?.email || normalizarEmailPortalAluno(aluno.email) !== token.destinatario) {
        throw new ErroRegra("Este convite não corresponde ao contato atual. Solicite outro acesso.");
      }
    }
    if (token.finalidade === "RECUPERACAO" && token.emailVerificado !== token.destinatario) {
      throw new ErroRegra("Este link não corresponde ao estado atual da conta.");
    }
    const prazos = await prazosPortalAlunoTx(tx);
    const senhaHash = await bcrypt.hash(dados.senha, 12);
    const versaoNova = token.versaoSessao + 1;
    // Consome primeiro para que o guard SQL da conta aceite a ativação apenas
    // quando há convite consumido para este mesmo destinatário.
    await tx.$executeRaw(Prisma.sql`UPDATE "TokenPortalAluno" SET "consumidoEm" = ${instanteUtc(agora)} WHERE id = ${token.id}`);
    await tx.$executeRaw(Prisma.sql`
      UPDATE "ContaPortalAluno"
      SET "senhaHash" = ${senhaHash}, "versaoSessao" = ${versaoNova},
        "emailVerificado" = CASE WHEN ${token.finalidade}::"FinalidadeTokenPortalAluno" = 'CONVITE' THEN ${token.destinatario} ELSE "emailVerificado" END,
        "emailVerificadoEm" = CASE WHEN ${token.finalidade}::"FinalidadeTokenPortalAluno" = 'CONVITE' THEN ${instanteUtc(agora)} ELSE "emailVerificadoEm" END,
        "atualizadaEm" = ${instanteUtc(agora)}
      WHERE id = ${token.contaId}
    `);
    await tx.$executeRaw(Prisma.sql`
      UPDATE "TokenPortalAluno" SET "revogadoEm" = ${instanteUtc(agora)}
      WHERE "contaId" = ${token.contaId} AND id <> ${token.id}
        AND "consumidoEm" IS NULL AND "revogadoEm" IS NULL
    `);
    await tx.$executeRaw(Prisma.sql`
      UPDATE "SessaoPortalAluno" SET "revogadaEm" = ${instanteUtc(agora)}
      WHERE "contaId" = ${token.contaId} AND "revogadaEm" IS NULL
    `);
    const sessao = await criarSessaoPortalAlunoTx(tx, { contaId: token.contaId, versaoConta: versaoNova, prazos, agora });
    return { tipo: "SESSAO" as const, sessaoCookie: sessao.segredo, expiraEm: sessao.expiraEm };
  });
}

export async function prepararTrocaEmailPortalAluno(input: { alunoId: string; novoEmail: string; motivo: string; evidencia: string }) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA, Papel.ADMINISTRADOR);
    const dados = z.object({ alunoId: z.string().min(1), novoEmail: z.string().trim().max(320), motivo: texto, evidencia: texto }).strict().parse(input);
    const novoEmail = normalizarEmailPortalAluno(dados.novoEmail);
    return prisma.$transaction(async (tx) => {
      await exigirFuncionarioAtualTx(tx, autor.id, Papel.SECRETARIA_ACADEMICA, Papel.ADMINISTRADOR);
      const conta = await obterOuCriarContaTx(tx, dados.alunoId);
      if (!conta.emailVerificado) throw new ErroRegra("A recuperação assistida exige uma conta com e-mail anterior verificado.");
      if (!conta.ativa) throw new ErroRegra("A conta do aluno está bloqueada.");
      if (conta.emailVerificado === novoEmail) throw new ErroRegra("O novo e-mail deve ser diferente do e-mail atual.");
      const id = randomUUID();
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO "SolicitacaoTrocaEmailPortalAluno"
          (id, "alunoId", "contaId", "emailAnterior", "novoEmail", "versaoContaConferida", motivo, evidencia, "preparadorId")
        VALUES (${id}, ${conta.alunoId}, ${conta.id}, ${conta.emailVerificado}, ${novoEmail}, ${conta.versaoSessao}, ${dados.motivo}, ${dados.evidencia}, ${autor.id})
      `);
      const envio = await criarEnvioPendenteTx(tx, { contaId: conta.id, finalidade: "VALIDAR_TROCA_EMAIL", destinatario: novoEmail, trocaEmailId: id });
      await registrarEvento(tx, {
        tipo: "TrocaEmailPortalAlunoPreparada", agregadoTipo: "Aluno", agregadoId: conta.alunoId, autorId: autor.id,
        payload: { solicitacaoId: id, solicitacaoEnvioId: envio.id },
      });
      return { solicitacaoId: id, solicitacaoEnvioId: envio.id, situacao: "PENDENTE_VALIDACAO" as const };
    });
  });
}

export async function decidirTrocaEmailPortalAluno(input: { solicitacaoId: string; aprovar: boolean; motivo: string }) {
  return executarAcao(async () => {
    const decisor = await exigirSessaoComPapel(Papel.ADMINISTRADOR);
    const dados = z.object({ solicitacaoId: z.string().min(1), aprovar: z.boolean(), motivo: texto }).strict().parse(input);
    return prisma.$transaction(async (tx) => {
      await exigirFuncionarioAtualTx(tx, decisor.id, Papel.ADMINISTRADOR);
      const [solicitacao] = await tx.$queryRaw<{
        id: string; alunoId: string; contaId: string; preparadorId: string; emailAnterior: string | null;
        novoEmail: string; verificadoEm: Date | null; versaoConferida: number; situacao: string;
        versaoAtual: number; emailAtual: string | null; ativa: boolean;
      }[]>(Prisma.sql`
        SELECT s.id, s."alunoId" AS "alunoId", s."contaId" AS "contaId", s."preparadorId" AS "preparadorId",
          s."emailAnterior" AS "emailAnterior", s."novoEmail" AS "novoEmail",
          s."novoEmailVerificadoEm" AS "verificadoEm", s."versaoContaConferida" AS "versaoConferida",
          s.situacao::text AS situacao, c."versaoSessao" AS "versaoAtual",
          c."emailVerificado" AS "emailAtual", c.ativa
        FROM "SolicitacaoTrocaEmailPortalAluno" s JOIN "ContaPortalAluno" c ON c.id = s."contaId"
        WHERE s.id = ${dados.solicitacaoId} FOR UPDATE OF s, c
      `);
      if (!solicitacao) throw new ErroRegra("Solicitação de troca de e-mail não encontrada.");
      if (solicitacao.preparadorId === decisor.id) throw new ErroPermissao("Outra pessoa da Administração deve decidir a troca de e-mail.");
      if (solicitacao.situacao !== "PENDENTE_DECISAO") throw new ErroRegra("A solicitação ainda não está pronta para decisão.");
      const [anterior] = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
        SELECT id FROM "DecisaoTrocaEmailPortalAluno" WHERE "solicitacaoId" = ${solicitacao.id} FOR UPDATE
      `);
      if (anterior) throw new ErroRegra("A solicitação já recebeu uma decisão.");
      const agora = new Date();
      if (dados.aprovar && (!solicitacao.verificadoEm || !solicitacao.ativa || solicitacao.versaoAtual !== solicitacao.versaoConferida || solicitacao.emailAtual !== solicitacao.emailAnterior)) {
        throw new ErroRegra("A conta mudou desde a conferência; prepare uma nova solicitação.");
      }
      const decisaoId = randomUUID();
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO "DecisaoTrocaEmailPortalAluno" (id, "solicitacaoId", "decisorId", aprovada, motivo)
        VALUES (${decisaoId}, ${solicitacao.id}, ${decisor.id}, ${dados.aprovar}, ${dados.motivo})
      `);
      if (!dados.aprovar) {
        await tx.$executeRaw(Prisma.sql`
          UPDATE "SolicitacaoTrocaEmailPortalAluno" SET situacao = 'REJEITADA', "decididaEm" = ${instanteUtc(agora)} WHERE id = ${solicitacao.id}
        `);
        return { decisaoId, aprovada: false as const };
      }
      const novaVersao = solicitacao.versaoAtual + 1;
      await tx.$executeRaw(Prisma.sql`
        UPDATE "SolicitacaoTrocaEmailPortalAluno" SET situacao = 'APROVADA_APLICADA', "decididaEm" = ${instanteUtc(agora)} WHERE id = ${solicitacao.id}
      `);
      await tx.$executeRaw(Prisma.sql`
        UPDATE "ContaPortalAluno" SET "emailVerificado" = ${solicitacao.novoEmail}, "emailVerificadoEm" = ${instanteUtc(agora)},
          "senhaHash" = NULL, "versaoSessao" = ${novaVersao}, "atualizadaEm" = ${instanteUtc(agora)} WHERE id = ${solicitacao.contaId}
      `);
      await tx.$executeRaw(Prisma.sql`
        UPDATE "SessaoPortalAluno" SET "revogadaEm" = ${instanteUtc(agora)} WHERE "contaId" = ${solicitacao.contaId} AND "revogadaEm" IS NULL
      `);
      await tx.$executeRaw(Prisma.sql`
        UPDATE "TokenPortalAluno" SET "revogadoEm" = ${instanteUtc(agora)} WHERE "contaId" = ${solicitacao.contaId} AND "consumidoEm" IS NULL AND "revogadoEm" IS NULL
      `);
      const envio = await criarEnvioPendenteTx(tx, { contaId: solicitacao.contaId, finalidade: "RECUPERACAO", destinatario: solicitacao.novoEmail });
      await registrarEvento(tx, {
        tipo: "TrocaEmailPortalAlunoAplicada", agregadoTipo: "Aluno", agregadoId: solicitacao.alunoId, autorId: decisor.id,
        payload: { solicitacaoId: solicitacao.id, decisaoId, solicitacaoEnvioId: envio.id },
      });
      return { decisaoId, aprovada: true as const, solicitacaoEnvioId: envio.id };
    });
  });
}

/**
 * Despacho interno com confirmação durável. Recebe o token bruto apenas
 * dentro do callback de entrega; actions e respostas HTTP nunca o retornam.
 */
export type ReciboEnvioPortalAluno = { provedor: "RESEND"; provedorId: string };

const ReciboEnvioPortalAlunoSchema = z.object({
  provedor: z.literal("RESEND"),
  provedorId: z.string().uuid(),
}).strict();

export async function despacharSolicitacaoPortalAlunoInterna(
  solicitacaoId: string,
  entregar: (mensagem: { finalidade: "CONVITE" | "RECUPERACAO" | "VALIDAR_TROCA_EMAIL"; destinatario: string; token: string; caminho: string }) => Promise<void | ReciboEnvioPortalAluno>,
) {
  const preparado = await prisma.$transaction(async (tx) => {
    const prazos = await prazosPortalAlunoTx(tx);
    const [solicitacao] = await tx.$queryRaw<{
      id: string; contaId: string; alunoId: string; finalidade: "CONVITE" | "RECUPERACAO" | "VALIDAR_TROCA_EMAIL";
      destinatario: string; trocaEmailId: string | null; situacao: string; ativa: boolean; email: string | null; senhaHash: string | null; recuperacaoAssistida: boolean;
    }[]>(Prisma.sql`
      SELECT e.id, e."contaId" AS "contaId", c."alunoId" AS "alunoId", e.finalidade::text AS finalidade, e.destinatario,
        e."trocaEmailId" AS "trocaEmailId", e.situacao::text AS situacao, c.ativa,
        c."emailVerificado" AS email, c."senhaHash" AS "senhaHash",
        EXISTS (
          SELECT 1 FROM "SolicitacaoTrocaEmailPortalAluno" s
          JOIN "DecisaoTrocaEmailPortalAluno" d ON d."solicitacaoId" = s.id AND d.aprovada = true
          WHERE s."contaId" = c.id AND s.situacao = 'APROVADA_APLICADA'
            AND s."novoEmail" = e.destinatario AND c."emailVerificado" = e.destinatario
        ) AS "recuperacaoAssistida"
      FROM "SolicitacaoEnvioPortalAluno" e JOIN "ContaPortalAluno" c ON c.id = e."contaId"
      WHERE e.id = ${solicitacaoId} FOR UPDATE OF e, c
    `);
    if (!solicitacao || solicitacao.situacao !== "PREPARADO" || !solicitacao.ativa) throw new ErroRegra("Solicitação de envio não está disponível.");
    if (solicitacao.finalidade === "CONVITE" && solicitacao.senhaHash) throw new ErroRegra("A conta já foi ativada.");
    if (solicitacao.finalidade === "CONVITE") {
      const [aluno] = await tx.$queryRaw<{ email: string | null }[]>(Prisma.sql`
        SELECT email FROM "Aluno" WHERE id = ${solicitacao.alunoId} FOR SHARE
      `);
      if (!aluno?.email || normalizarEmailPortalAluno(aluno.email) !== solicitacao.destinatario) {
        throw new ErroRegra("O contato do aluno mudou; confira os dados e prepare um novo convite.");
      }
    }
    if (solicitacao.finalidade === "RECUPERACAO" && (solicitacao.email !== solicitacao.destinatario || (!solicitacao.senhaHash && !solicitacao.recuperacaoAssistida))) {
      throw new ErroRegra("O destinatário de recuperação não está mais autorizado.");
    }
    if (solicitacao.finalidade === "VALIDAR_TROCA_EMAIL") {
      const [troca] = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
        SELECT id FROM "SolicitacaoTrocaEmailPortalAluno" WHERE id = ${solicitacao.trocaEmailId} AND situacao = 'PENDENTE_VALIDACAO' AND "novoEmail" = ${solicitacao.destinatario} FOR UPDATE
      `);
      if (!troca) throw new ErroRegra("A validação de e-mail não está mais disponível.");
    }
    const minutos = solicitacao.finalidade === "CONVITE" ? prazos.conviteMinutos
      : solicitacao.finalidade === "RECUPERACAO" ? prazos.recuperacaoMinutos : prazos.validacaoEmailMinutos;
    const agora = new Date();
    const tokenBruto = gerarSegredoPortalAluno();
    const tokenId = randomUUID();
    // Um único link ainda utilizável por finalidade evita que uma reemissão
    // deliberada deixe dois caminhos de redefinição abertos.
    await tx.$executeRaw(Prisma.sql`
      UPDATE "TokenPortalAluno" SET "revogadoEm" = ${instanteUtc(agora)}
      WHERE "contaId" = ${solicitacao.contaId} AND finalidade = ${solicitacao.finalidade}::"FinalidadeTokenPortalAluno"
        AND "consumidoEm" IS NULL AND "revogadoEm" IS NULL
    `);
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO "TokenPortalAluno" (id, "contaId", finalidade, digest, destinatario, "trocaEmailId", "expiraEm")
      VALUES (${tokenId}, ${solicitacao.contaId}, ${solicitacao.finalidade}::"FinalidadeTokenPortalAluno", ${digestSegredoPortalAluno(tokenBruto)},
        ${solicitacao.destinatario}, ${solicitacao.trocaEmailId}, ${instanteUtc(new Date(agora.getTime() + minutos * 60_000))})
    `);
    // A transação termina ANTES de qualquer I/O externo. INCERTO é a claim
    // durável: se o processo cair depois daqui, ninguém tenta reenviar sem
    // conciliação humana/provedor e o segredo já não está recuperável do DB.
    await tx.$executeRaw(Prisma.sql`
      UPDATE "SolicitacaoEnvioPortalAluno" SET situacao = 'INCERTO', "atualizadoEm" = ${instanteUtc(agora)}
      WHERE id = ${solicitacao.id} AND situacao = 'PREPARADO'
    `);
    return { solicitacaoId: solicitacao.id, alunoId: solicitacao.alunoId, finalidade: solicitacao.finalidade, destinatario: solicitacao.destinatario, token: tokenBruto };
  });
  let retorno: void | ReciboEnvioPortalAluno;
  try {
    // Este é o único ponto onde o token bruto cruza a fronteira interna para
    // a fila/provedor institucional. Recibo malformado é resultado incerto.
    retorno = await entregar({ finalidade: preparado.finalidade, destinatario: preparado.destinatario, token: preparado.token, caminho: caminhoAtivacaoPortalAluno(preparado.token) });
    if (retorno !== undefined) retorno = ReciboEnvioPortalAlunoSchema.parse(retorno);
  } catch {
    return { solicitacaoId: preparado.solicitacaoId, situacao: "INCERTO" as const };
  }
  try {
    const confirmado = await prisma.$transaction(async (tx) => {
      const atualizado = await tx.$executeRaw(Prisma.sql`
        UPDATE "SolicitacaoEnvioPortalAluno" SET situacao = 'ENVIADO', "atualizadoEm" = ${instanteUtc(new Date())}
        WHERE id = ${preparado.solicitacaoId} AND situacao = 'INCERTO'
      `);
      if (atualizado !== 1) return false;
      if (retorno) {
        await registrarEvento(tx, {
          tipo: "SolicitacaoEnvioPortalAlunoAceitaPeloProvedor", agregadoTipo: "Aluno", agregadoId: preparado.alunoId,
          payload: { solicitacaoEnvioId: preparado.solicitacaoId, provedor: retorno.provedor, provedorId: retorno.provedorId },
        });
      }
      return true;
    });
    // ENVIADO significa aceito pelo provedor, não confirmação de entrega.
    return { solicitacaoId: preparado.solicitacaoId, situacao: confirmado ? "ENVIADO" as const : "INCERTO" as const };
  } catch {
    return { solicitacaoId: preparado.solicitacaoId, situacao: "INCERTO" as const };
  }
}
