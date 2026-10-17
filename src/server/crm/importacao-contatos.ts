import { randomUUID } from "node:crypto";
import { Papel, type OrigemCanal, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { gerarCodigo } from "@/lib/codigo";
import { ORIGEM_CANAL_LABEL } from "@/lib/labels";
import { registrarEvento } from "@/server/_shared/evento";
import { ErroPermissao, ErroRegra, type UsuarioSessao } from "@/server/_shared/sessao";
import { normalizarTelefoneE164 } from "@/server/_shared/validacao";
import { escopoPessoas, garantirPessoaTx } from "./pessoas";

type Tx = Prisma.TransactionClient;

/** Colunas aceitas. Não há coluna de consentimento: opt-in nunca vem de planilha (P4). */
export const COLUNAS_IMPORTACAO_CONTATOS = ["Nome", "WhatsApp", "E-mail", "Cidade", "Origem", "Tag"] as const;

export const MAX_BYTES_IMPORTACAO_CONTATOS = 5 * 1024 * 1024;
export const MAX_LINHAS_IMPORTACAO_CONTATOS = 1000;

export type LinhaImportavel = {
  /** Número da linha na planilha (cabeçalho = 1). */
  linha: number;
  nome: string;
  telefoneE164: string | null;
  email: string | null;
  cidade: string | null;
  origemCanal: OrigemCanal | null;
  tag: string | null;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const semAcento = (v: string) => v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

const ORIGENS = new Map<string, OrigemCanal>(
  (Object.entries(ORIGEM_CANAL_LABEL) as [OrigemCanal, string][]).flatMap(([codigo, rotulo]) => [
    [semAcento(rotulo), codigo],
    [semAcento(codigo), codigo],
  ]),
);

/** Chave de cabeçalho tolerante a caixa e acento ("e-mail", "WHATSAPP"). */
export function chaveColuna(cabecalho: string): (typeof COLUNAS_IMPORTACAO_CONTATOS)[number] | null {
  const alvo = semAcento(cabecalho);
  return COLUNAS_IMPORTACAO_CONTATOS.find((c) => semAcento(c) === alvo) ?? null;
}

/**
 * Valida as linhas da planilha (a primeira linha de dados é a linha 2). Linha repetida na planilha
 * (mesmo telefone ou, sem telefone, mesmo e-mail) conta uma vez em `repetidasNaPlanilha` e não é erro.
 */
export function analisarPlanilhaContatos(
  linhas: Record<string, string>[],
  ddiPadrao: string,
): { validas: LinhaImportavel[]; invalidas: { linha: number; motivo: string }[]; repetidasNaPlanilha: number } {
  const validas: LinhaImportavel[] = [];
  const invalidas: { linha: number; motivo: string }[] = [];
  const vistas = new Set<string>();
  let repetidasNaPlanilha = 0;
  linhas.forEach((bruta, i) => {
    const linha = i + 2;
    const campo = (c: (typeof COLUNAS_IMPORTACAO_CONTATOS)[number]) => (bruta[c] ?? "").trim();
    const nome = campo("Nome");
    if (!nome) return void invalidas.push({ linha, motivo: "Informe o nome." });
    if (nome.length > 200) return void invalidas.push({ linha, motivo: "O nome deve ter até 200 caracteres." });
    const telefoneBruto = campo("WhatsApp");
    const telefoneE164 = normalizarTelefoneE164(telefoneBruto, ddiPadrao);
    if (telefoneBruto && (!telefoneE164 || telefoneE164.length < 9 || telefoneE164.length > 16)) {
      return void invalidas.push({ linha, motivo: "WhatsApp inválido." });
    }
    const email = campo("E-mail").toLowerCase() || null;
    if (email && (!EMAIL.test(email) || email.length > 200)) return void invalidas.push({ linha, motivo: "E-mail inválido." });
    if (!telefoneE164 && !email) return void invalidas.push({ linha, motivo: "Informe o WhatsApp ou o e-mail." });
    const origemTexto = campo("Origem");
    const chave = telefoneE164 ? `t:${telefoneE164}` : `e:${email}`;
    if (vistas.has(chave)) {
      repetidasNaPlanilha++;
      return;
    }
    vistas.add(chave);
    validas.push({
      linha,
      nome,
      telefoneE164,
      email,
      cidade: campo("Cidade").slice(0, 120) || null,
      origemCanal: origemTexto ? (ORIGENS.get(semAcento(origemTexto)) ?? null) : null,
      tag: campo("Tag").slice(0, 40) || null,
    });
  });
  return { validas, invalidas, repetidasNaPlanilha };
}

/** O dono precisa ser vendedor ativo; gerente só atribui a si ou à sua equipe. */
export async function exigirDonoDaImportacao(autor: UsuarioSessao, donoId: string): Promise<void> {
  const dono = await prisma.usuario.findFirst({
    where: { id: donoId, ativo: true, papeis: { has: Papel.VENDEDOR } },
    select: { id: true, gerenteComercialId: true },
  });
  if (!dono) throw new ErroRegra("Selecione um vendedor ativo.");
  if (autor.papeis.includes(Papel.ADMINISTRADOR) || dono.id === autor.id) return;
  if (!(autor.papeis.includes(Papel.GERENTE_COMERCIAL) && dono.gerenteComercialId === autor.id)) {
    throw new ErroPermissao("O vendedor não pertence à sua equipe.");
  }
}

/** Prévia sem gravar: quantas linhas casam com um contato já existente (telefone ou e-mail). */
export async function previaContatos(validas: LinhaImportavel[]): Promise<{ novos: number; existentes: number }> {
  const telefones = validas.flatMap((l) => (l.telefoneE164 ? [l.telefoneE164] : []));
  const emails = validas.filter((l) => !l.telefoneE164 && l.email).map((l) => l.email!);
  const [contatos, pessoas] = await Promise.all([
    prisma.contatoWhatsApp.findMany({ where: { telefoneE164: { in: telefones }, pessoaId: { not: null } }, select: { telefoneE164: true } }),
    prisma.pessoa.findMany({ where: { mescladaEmId: null, email: { in: emails, mode: "insensitive" } }, select: { email: true } }),
  ]);
  const tel = new Set(contatos.map((c) => c.telefoneE164));
  const mail = new Set<string | undefined>(pessoas.map((p) => p.email?.toLowerCase()));
  const existentes = validas.filter((l) => (l.telefoneE164 ? tel.has(l.telefoneE164) : mail.has(l.email ?? undefined))).length;
  return { novos: validas.length - existentes, existentes };
}

/**
 * Aplica UMA linha em transação própria (quem chama abre a `tx`). Pessoa existente só recebe campos vazios;
 * `Aluno`/`Responsavel` não têm dado alterado (a ligação `pessoaId` é a do hub, feita por `garantirPessoaTx`).
 * Pessoa existente fora de `escopoPessoas(autor)` não é tocada. Pessoa nova ganha oportunidade NOVO quando há
 * `donoId`. Nenhum consentimento é gravado.
 */
export async function aplicarLinhaContato(
  tx: Tx,
  l: LinhaImportavel,
  autor: UsuarioSessao,
  donoId: string | null,
): Promise<{ criada: boolean; oportunidade: boolean }> {
  const autorId = autor.id;
  let achada: string | null = null;
  let criada = false;
  if (!l.telefoneE164 && l.email) {
    const porEmail = await tx.pessoa.findFirst({
      where: { mescladaEmId: null, email: { equals: l.email, mode: "insensitive" } },
      select: { id: true },
      orderBy: { criadoEm: "asc" },
    });
    achada = porEmail?.id ?? null;
  }
  if (!achada) {
    ({ pessoaId: achada, criada } = await garantirPessoaTx(
      tx,
      { nome: l.nome, telefoneE164: l.telefoneE164, email: l.email, origemCanal: l.origemCanal ?? "IMPORTACAO" },
      autorId,
    ));
  }
  const pessoaId: string = achada!;
  if (!criada) {
    // Escopo comercial: pessoa existente fora da carteira do autor conta como existente e não é tocada
    // (nem campos, nem tag, nem Evento).
    const noEscopo = await tx.pessoa.findFirst({ where: { AND: [{ id: pessoaId }, await escopoPessoas(autor, tx)] }, select: { id: true } });
    if (!noEscopo) return { criada: false, oportunidade: false };

    const atual = await tx.pessoa.findUniqueOrThrow({ where: { id: pessoaId }, select: { email: true, cidade: true, origemCanal: true } });
    const completar: Prisma.PessoaUpdateInput = {};
    if (!atual.email && l.email) completar.email = l.email;
    if (!atual.cidade && l.cidade) completar.cidade = l.cidade;
    if (!atual.origemCanal && l.origemCanal) completar.origemCanal = l.origemCanal;
    if (Object.keys(completar).length) {
      await tx.pessoa.update({ where: { id: pessoaId }, data: completar });
      await registrarEvento(tx, {
        tipo: "PessoaCompletadaPorImportacao",
        agregadoTipo: "Pessoa",
        agregadoId: pessoaId,
        autorId,
        payload: { campos: Object.keys(completar) },
      });
    }
  } else if (l.cidade) {
    await tx.pessoa.update({ where: { id: pessoaId }, data: { cidade: l.cidade } });
  }

  if (l.tag) {
    let tag = await tx.tag.findUnique({ where: { nome: l.tag }, select: { id: true, ativo: true } });
    if (!tag) {
      const nova = await tx.tag.create({ data: { nome: l.tag, cor: "NEUTRA" } });
      await registrarEvento(tx, { tipo: "TagCriada", agregadoTipo: "Tag", agregadoId: nova.id, autorId, payload: { nome: nova.nome, cor: nova.cor, grupo: null, via: "importacao" } });
      tag = { id: nova.id, ativo: true };
    }
    if (tag.ativo) {
      const ja = await tx.pessoaTag.findUnique({ where: { pessoaId_tagId: { pessoaId, tagId: tag.id } } });
      if (!ja) {
        await tx.pessoaTag.create({ data: { pessoaId, tagId: tag.id, criadoPorId: autorId } });
        await registrarEvento(tx, { tipo: "TagAtribuida", agregadoTipo: "Pessoa", agregadoId: pessoaId, autorId, payload: { tagId: tag.id, nome: l.tag } });
      }
    }
  }

  let oportunidade = false;
  if (criada && donoId) {
    const codigo = await gerarCodigo("lead", tx);
    const lead = await tx.oportunidade.create({
      data: { codigo, nome: l.nome, telefoneE164: l.telefoneE164, pessoaId, origemCanal: l.origemCanal ?? "IMPORTACAO", vendedorDonoId: donoId },
    });
    await registrarEvento(tx, { tipo: "LeadCriado", agregadoTipo: "Lead", agregadoId: lead.id, autorId, payload: { codigo, nome: lead.nome, origem: "importacao_contatos", b2b: false, pessoaId } });
    await registrarEvento(tx, { tipo: "LeadAtribuido", agregadoTipo: "Lead", agregadoId: lead.id, autorId, payload: { de: null, para: donoId, via: "importacao_contatos" } });
    oportunidade = true;
  }
  return { criada, oportunidade };
}

/** Evento-resumo da importação: só contagens, nunca nome, telefone ou e-mail. */
export async function registrarResumoImportacao(
  tx: Tx,
  autorId: string,
  resumo: { novos: number; atualizados: number; invalidos: number; comOportunidade: number },
): Promise<void> {
  await registrarEvento(tx, { tipo: "ContatosImportados", agregadoTipo: "Importacao", agregadoId: randomUUID(), autorId, payload: resumo });
}
