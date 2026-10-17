import { Papel, type OrigemCanal, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { registrarEvento } from "@/server/_shared/evento";
import { escopoComercialAtual } from "@/server/_shared/escopo-comercial";
import type { UsuarioSessao } from "@/server/_shared/sessao";

type Tx = Prisma.TransactionClient;

export type EntradaPessoa = {
  nome: string;
  telefoneE164?: string | null;
  email?: string | null;
  alunoId?: string;
  responsavelId?: string;
  origemCanal?: OrigemCanal;
};

const SEM_ACESSO: Prisma.PessoaWhereInput = { id: "__sem_acesso__" };

/** "Maria  Álvaro" -> "maria alvaro" (sem acento, minúsculo, espaços colapsados). */
export function normalizarNome(nome: string): string {
  return nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Escopo de leitura de Pessoa por papel (regras da Tarefa 19). Lápides (`mescladaEmId`) ficam sempre fora.
 * - ADMIN e GC: pessoas da equipe, mais as sem oportunidade, mais as sem dono;
 * - VEN: as que têm oportunidade em `escopoComercialAtual`;
 * - SEC: as que têm aluno ou responsável;
 * - demais: nada.
 */
export async function escopoPessoas(
  usuario: UsuarioSessao,
  tx: Tx | typeof prisma = prisma,
): Promise<Prisma.PessoaWhereInput> {
  if (!usuario?.id) return SEM_ACESSO;
  const ou: Prisma.PessoaWhereInput[] = [];
  const papeis = usuario.papeis;
  const gestao = papeis.includes(Papel.ADMINISTRADOR) || papeis.includes(Papel.GERENTE_COMERCIAL);
  if (gestao || papeis.includes(Papel.VENDEDOR)) {
    const escopo = await escopoComercialAtual(usuario, tx);
    ou.push({ oportunidades: { some: escopo } });
    if (gestao) {
      ou.push({ oportunidades: { none: {} } });
      ou.push({ oportunidades: { every: { vendedorDonoId: null } } });
    }
  }
  if (papeis.includes(Papel.SECRETARIA_ACADEMICA)) {
    ou.push({ aluno: { isNot: null } }, { responsavel: { isNot: null } });
  }
  if (!ou.length) return SEM_ACESSO;
  return { mescladaEmId: null, OR: ou };
}

async function criarPessoa(tx: Tx, e: EntradaPessoa, autorId: string | null, vinculo: string | null): Promise<string> {
  const pessoa = await tx.pessoa.create({
    data: { nome: e.nome, email: e.email ? e.email.trim().toLowerCase() : null, origemCanal: e.origemCanal ?? null },
  });
  await registrarEvento(tx, {
    tipo: "PessoaCriada",
    agregadoTipo: "Pessoa",
    agregadoId: pessoa.id,
    autorId,
    // Sem telefone nem e-mail: o payload do evento não carrega dado de contato.
    payload: { nome: pessoa.nome, origemCanal: e.origemCanal ?? null, vinculo },
  });
  return pessoa.id;
}

/** Chave do advisory lock por telefone normalizado. Exportada para o teste conferir o lock. */
export function chaveLockPessoaTelefone(telefoneE164: string): string {
  return `pessoa:${telefoneE164}`;
}

async function travarTelefoneTx(tx: Tx, telefoneE164: string): Promise<void> {
  // $executeRaw: pg_advisory_xact_lock devolve `void`, que o $queryRaw não desserializa.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${chaveLockPessoaTelefone(telefoneE164)}, 0))`;
}

/**
 * Garante a Pessoa de uma identidade, sem duplicar. Precedência:
 * 1. `ContatoWhatsApp.pessoaId` do telefone;
 * 2. aluno/responsável (explícito ou com o mesmo telefone). Se o telefone casar com mais de um,
 *    cria pessoa nova e não liga a nenhum: telefone compartilhado não identifica a pessoa;
 * 3. criar.
 * `ContatoWhatsApp` é upserted e só recebe `pessoaId` quando estava nulo.
 * O `email` só é gravado quando a Pessoa é criada aqui; Pessoa achada não é atualizada (intencional
 * nesta fase; R1 do PR #194, C2).
 */
export async function garantirPessoaTx(
  tx: Tx,
  e: EntradaPessoa,
  autorId: string | null,
): Promise<{ pessoaId: string; criada: boolean }> {
  const telefone = e.telefoneE164 || null;
  // Serializa criações simultâneas do mesmo telefone (R1 do PR #194, C3): sem o lock, duas transações
  // leem `contato = null`, criam duas Pessoas e a segunda oportunidade aponta para uma órfã. O lock é
  // da transação (solto no commit/rollback) e vem ANTES da busca, para a segunda ler o contato já gravado.
  // `telefone` já chega normalizado em E.164 (quem chama normaliza).
  if (telefone) await travarTelefoneTx(tx, telefone);
  const contato = telefone ? await tx.contatoWhatsApp.findUnique({ where: { telefoneE164: telefone } }) : null;

  let pessoaId: string | null = contato?.pessoaId ?? null;
  let criada = false;

  if (!pessoaId) {
    type Alvo = { tipo: "aluno" | "responsavel"; id: string; pessoaId: string | null };
    let alvos: Alvo[] = [];
    if (e.alunoId) {
      const a = await tx.aluno.findUnique({ where: { id: e.alunoId }, select: { id: true, pessoaId: true } });
      if (a) alvos = [{ tipo: "aluno", ...a }];
    } else if (e.responsavelId) {
      const r = await tx.responsavel.findUnique({ where: { id: e.responsavelId }, select: { id: true, pessoaId: true } });
      if (r) alvos = [{ tipo: "responsavel", ...r }];
    } else if (telefone) {
      const [alunos, responsaveis] = await Promise.all([
        tx.aluno.findMany({ where: { telefoneE164: telefone }, select: { id: true, pessoaId: true }, take: 2 }),
        tx.responsavel.findMany({ where: { telefoneE164: telefone }, select: { id: true, pessoaId: true }, take: 2 }),
      ]);
      alvos = [
        ...alunos.map((a): Alvo => ({ tipo: "aluno", ...a })),
        ...responsaveis.map((r): Alvo => ({ tipo: "responsavel", ...r })),
      ];
    }

    if (alvos.length === 1) {
      const alvo = alvos[0];
      if (alvo.pessoaId) {
        pessoaId = alvo.pessoaId;
      } else {
        pessoaId = await criarPessoa(tx, e, autorId, alvo.tipo);
        criada = true;
        if (alvo.tipo === "aluno") await tx.aluno.update({ where: { id: alvo.id }, data: { pessoaId } });
        else await tx.responsavel.update({ where: { id: alvo.id }, data: { pessoaId } });
      }
    } else {
      pessoaId = await criarPessoa(tx, e, autorId, null);
      criada = true;
    }
  }

  if (telefone) {
    await tx.contatoWhatsApp.upsert({
      where: { telefoneE164: telefone },
      create: { telefoneE164: telefone, pessoaId },
      update: contato && !contato.pessoaId ? { pessoaId } : {},
    });
  }
  return { pessoaId, criada };
}

export type PossivelDuplicado = { pessoaId: string | null; nome: string | null; motivo: "telefone" | "email" | "nome" };

/**
 * Candidatas a duplicata por telefone, e-mail (minúsculo) e nome (sem acento), no máximo 5.
 * Pessoa fora do escopo do usuário volta com `pessoaId` e `nome` nulos ("Já existe no CRM").
 */
export async function possiveisDuplicados(
  e: { nome?: string; telefoneE164?: string | null; email?: string | null },
  usuario: UsuarioSessao,
): Promise<PossivelDuplicado[]> {
  const achados = new Map<string, { nome: string; motivo: PossivelDuplicado["motivo"] }>();
  const marcar = (lista: { id: string; nome: string }[], motivo: PossivelDuplicado["motivo"]) => {
    for (const p of lista) if (!achados.has(p.id)) achados.set(p.id, { nome: p.nome, motivo });
  };
  const ativa = { mescladaEmId: null } satisfies Prisma.PessoaWhereInput;

  if (e.telefoneE164) {
    const t = e.telefoneE164;
    marcar(
      await prisma.pessoa.findMany({
        where: {
          ...ativa,
          OR: [
            { contatosWhatsApp: { some: { telefoneE164: t } } },
            { aluno: { telefoneE164: t } },
            { responsavel: { telefoneE164: t } },
          ],
        },
        select: { id: true, nome: true },
        orderBy: { criadoEm: "asc" },
        take: 5,
      }),
      "telefone",
    );
  }
  const email = e.email?.trim().toLowerCase();
  if (email) {
    marcar(
      await prisma.pessoa.findMany({
        where: { ...ativa, email: { equals: email, mode: "insensitive" } },
        select: { id: true, nome: true },
        orderBy: { criadoEm: "asc" },
        take: 5,
      }),
      "email",
    );
  }
  const nome = e.nome ? normalizarNome(e.nome) : "";
  if (nome) {
    const linhas = await prisma.$queryRaw<{ id: string; nome: string }[]>`
      SELECT "id", "nome" FROM "Pessoa"
      WHERE "mescladaEmId" IS NULL
        AND regexp_replace(translate(lower("nome"), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn'), '\\s+', ' ', 'g') = ${nome}
      ORDER BY "criadoEm" ASC
      LIMIT 5`;
    marcar(linhas, "nome");
  }
  if (!achados.size) return [];

  const visiveis = new Set(
    (
      await prisma.pessoa.findMany({
        where: { AND: [{ id: { in: [...achados.keys()] } }, await escopoPessoas(usuario)] },
        select: { id: true },
      })
    ).map((p) => p.id),
  );
  return [...achados.entries()].slice(0, 5).map(([id, a]) =>
    visiveis.has(id) ? { pessoaId: id, nome: a.nome, motivo: a.motivo } : { pessoaId: null, nome: null, motivo: a.motivo },
  );
}
