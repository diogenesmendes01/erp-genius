import { Papel } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { registrarEvento } from "@/server/_shared/evento";
import { executarAcao, type Resultado } from "@/server/_shared/resultado";
import { ErroRegra, exigirSessao, type UsuarioSessao } from "@/server/_shared/sessao";
import { exigirCapacidadeCrm } from "./permissoes";
import { escopoPessoas, normalizarNome } from "./pessoas";

export type PessoaComparavel = { id: string; nome: string; email: string | null; telefones: string[] };
export type MotivoDuplicado = "telefone" | "email" | "nome";

const PONTOS = { telefone: 100, email: 80, nome: 40 } as const;
const LIMIAR = 60;

/** Telefone 100, e-mail 80 e nome normalizado 40, somados sem teto. Candidato a partir de 60. */
export function pontuarDuplicado(a: PessoaComparavel, b: PessoaComparavel): { pontos: number; motivos: MotivoDuplicado[] } {
  const motivos: MotivoDuplicado[] = [];
  if (a.telefones.some((t) => b.telefones.includes(t))) motivos.push("telefone");
  const ea = a.email?.trim().toLowerCase();
  const eb = b.email?.trim().toLowerCase();
  if (ea && eb && ea === eb) motivos.push("email");
  const na = normalizarNome(a.nome);
  if (na && na === normalizarNome(b.nome)) motivos.push("nome");
  return { pontos: motivos.reduce((s, m) => s + PONTOS[m], 0), motivos };
}

export const MSG_NOME_ALUNO = "Nome e e-mail de aluno são alterados pela Secretaria. Na mesclagem, mantenha o nome e o e-mail do aluno.";

export const MSG_ACADEMICO = "Estas pessoas têm cadastro acadêmico. A Secretaria decide se são a mesma pessoa.";

/** Pares candidatos dentro do escopo de leitura do usuário, do mais para o menos provável. Pares com cadastro acadêmico dos dois lados ficam de fora (a mescla é proibida). */
export async function sugerirDuplicados(
  usuario: UsuarioSessao,
  limite = 50,
): Promise<{ a: string; b: string; pontos: number; motivos: string[] }[]> {
  const pessoas = await prisma.pessoa.findMany({
    where: await escopoPessoas(usuario),
    select: {
      id: true,
      nome: true,
      email: true,
      aluno: { select: { id: true } },
      responsavel: { select: { id: true } },
      contatosWhatsApp: { select: { telefoneE164: true } },
    },
  });
  const itens = pessoas.map((p) => ({
    c: { id: p.id, nome: p.nome, email: p.email, telefones: p.contatosWhatsApp.map((x) => x.telefoneE164) } as PessoaComparavel,
    academica: !!p.aluno || !!p.responsavel,
  }));

  // Bloqueio por chave (telefone, e-mail, nome) para evitar o produto cartesiano.
  const baldes = new Map<string, number[]>();
  const juntar = (chave: string, i: number) => {
    const l = baldes.get(chave);
    if (l) l.push(i);
    else baldes.set(chave, [i]);
  };
  itens.forEach(({ c }, i) => {
    for (const t of c.telefones) juntar(`t:${t}`, i);
    if (c.email) juntar(`e:${c.email.trim().toLowerCase()}`, i);
    const n = normalizarNome(c.nome);
    if (n) juntar(`n:${n}`, i);
  });
  const vistos = new Set<string>();
  const saida: { a: string; b: string; pontos: number; motivos: string[] }[] = [];
  for (const lista of baldes.values()) {
    for (let x = 0; x < lista.length; x++) {
      for (let y = x + 1; y < lista.length; y++) {
        const [i, j] = lista[x] < lista[y] ? [lista[x], lista[y]] : [lista[y], lista[x]];
        const chave = `${i}:${j}`;
        if (vistos.has(chave)) continue;
        vistos.add(chave);
        if (itens[i].academica && itens[j].academica) continue;
        const r = pontuarDuplicado(itens[i].c, itens[j].c);
        if (r.pontos >= LIMIAR) saida.push({ a: itens[i].c.id, b: itens[j].c.id, pontos: r.pontos, motivos: r.motivos });
      }
    }
  }
  saida.sort((p, q) => q.pontos - p.pontos || p.a.localeCompare(q.a) || p.b.localeCompare(q.b));
  return saida.slice(0, Math.max(0, limite));
}

const LADO = z.enum(["principal", "secundaria"]);
const MesclaSchema = z.object({
  principalId: z.string().min(1),
  secundariaId: z.string().min(1),
  escolhas: z.object({ nome: LADO, email: LADO, cidade: LADO, cargo: LADO }).partial(),
});

const CAMPOS = ["nome", "email", "cidade", "cargo"] as const;

type EntradaMescla = {
  principalId: string;
  secundariaId: string;
  escolhas: Partial<Record<(typeof CAMPOS)[number], "principal" | "secundaria">>;
};
type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * D14 (decisão do dono, 19/10/2026; #211 C4): repor `Aluno.pessoaId`/`Responsavel.pessoaId` pela mescla é decisão
 * da Secretaria. Quem tem a alçada: Secretaria Acadêmica ou Administrador (que tem todas). Continua valendo
 * `contatos.mesclar` para mesclar qualquer par.
 */
export function temAlcadaSecretaria(papeis: readonly Papel[]): boolean {
  return papeis.includes(Papel.SECRETARIA_ACADEMICA) || papeis.includes(Papel.ADMINISTRADOR);
}

export const MSG_ALCADA_SECRETARIA_MESCLA =
  "Esta mesclagem passa o cadastro acadêmico (aluno ou responsável) para o outro contato. Só quem tem a alçada da Secretaria pode confirmá-la.";

/** O que a mesclagem muda, calculado antes de confirmar. `bloqueio` traz a recusa que a mesclagem daria. */
export type PreviaMescla = {
  principal: { id: string; nome: string };
  secundaria: { id: string; nome: string };
  /** Campos da principal que passam a ter o valor da secundária. */
  camposDaSecundaria: (typeof CAMPOS)[number][];
  movidos: { contatos: number; oportunidades: number; participantes: number; tags: number; valoresCampo: number };
  /** Cadastro acadêmico da secundária que passa para a principal (null quando nada muda). */
  cadastroAcademico: { aluno: boolean; responsavel: boolean } | null;
  exigeSecretaria: boolean;
  bloqueio: string | null;
};

/**
 * Leituras e regras comuns à prévia e à mesclagem: as duas pessoas no escopo, nenhuma lápide, cadastro acadêmico
 * de um lado só, alçada da Secretaria para movê-lo e nome/e-mail de aluno. Nada é gravado aqui.
 */
async function analisarMesclaTx(tx: Tx, autor: UsuarioSessao, dados: z.infer<typeof MesclaSchema>) {
  const ids = [dados.principalId, dados.secundariaId].sort();
  const visiveis = await tx.pessoa.findMany({
    where: { AND: [{ id: { in: ids } }, await escopoPessoas(autor, tx)] },
    select: { id: true },
  });
  if (visiveis.length !== 2) throw new ErroRegra("Pessoa não encontrada.");

  const sel = { aluno: { select: { id: true } }, responsavel: { select: { id: true } } } as const;
  const principal = await tx.pessoa.findUniqueOrThrow({ where: { id: dados.principalId }, include: sel });
  const secundaria = await tx.pessoa.findUniqueOrThrow({ where: { id: dados.secundariaId }, include: sel });
  if (principal.mescladaEmId || secundaria.mescladaEmId) throw new ErroRegra("Uma das pessoas já foi mesclada.");
  const academica = (p: typeof principal) => !!p.aluno || !!p.responsavel;
  if (academica(principal) && academica(secundaria)) throw new ErroRegra(MSG_ACADEMICO);

  // Cadastro acadêmico: só se a secundária for a única com ele.
  const moveAcademico = academica(secundaria) && !academica(principal);

  const dadosPrincipal: Record<string, string | null> = {};
  const mudados: (typeof CAMPOS)[number][] = [];
  for (const campo of CAMPOS) {
    if (dados.escolhas[campo] === "secundaria" && secundaria[campo] !== principal[campo]) {
      dadosPrincipal[campo] = secundaria[campo];
      mudados.push(campo);
    }
  }

  let bloqueio: string | null = null;
  if (moveAcademico && !temAlcadaSecretaria(autor.papeis)) bloqueio = MSG_ALCADA_SECRETARIA_MESCLA;
  // Mesma trava de editarPessoa: nome e e-mail de aluno só mudam por Administrador. Vale para o aluno
  // de qualquer lado; quando o cadastro acadêmico vem da secundária, o nome que fica precisa ser o dela.
  const ladoAluno = principal.aluno ? principal : secundaria.aluno ? secundaria : null;
  if (!bloqueio && ladoAluno && !autor.papeis.includes(Papel.ADMINISTRADOR)) {
    const final = { nome: principal.nome, email: principal.email, ...dadosPrincipal };
    if (final.nome !== ladoAluno.nome || final.email !== ladoAluno.email) bloqueio = MSG_NOME_ALUNO;
  }
  return { principal, secundaria, moveAcademico, dadosPrincipal, mudados, bloqueio };
}

/**
 * Prévia da mesclagem (D14): o que passa da secundária para a principal, os campos que mudam, o cadastro
 * acadêmico que é reposto e, quando a mesclagem seria recusada, o motivo. Só leitura: nada é gravado.
 */
export async function previaMesclaPessoas(input: EntradaMescla): Promise<Resultado<PreviaMescla>> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    exigirCapacidadeCrm(autor, "contatos.mesclar");
    const dados = MesclaSchema.parse(input);
    if (dados.principalId === dados.secundariaId) throw new ErroRegra("Escolha duas pessoas diferentes.");
    return prisma.$transaction(async (tx) => {
      const a = await analisarMesclaTx(tx, autor, dados);
      const de = dados.principalId;
      const para = dados.secundariaId;
      const jaParticipa = await tx.participanteOportunidade.findMany({ where: { pessoaId: de }, select: { oportunidadeId: true } });
      const tagsPrincipal = await tx.pessoaTag.findMany({ where: { pessoaId: de }, select: { tagId: true } });
      const valoresPrincipal = await tx.valorCampoPersonalizado.findMany({ where: { pessoaId: de } });
      const porCampo = new Map(valoresPrincipal.map((v) => [v.campoId, v]));
      const valoresSecundaria = await tx.valorCampoPersonalizado.findMany({ where: { pessoaId: para } });
      const valoresCampo = valoresSecundaria.filter((v) => {
        const existente = porCampo.get(v.campoId);
        return !existente || (existente.valor === null && v.valor !== null);
      }).length;
      return {
        principal: { id: a.principal.id, nome: a.principal.nome },
        secundaria: { id: a.secundaria.id, nome: a.secundaria.nome },
        camposDaSecundaria: a.mudados,
        movidos: {
          contatos: await tx.contatoWhatsApp.count({ where: { pessoaId: para } }),
          oportunidades: await tx.oportunidade.count({ where: { pessoaId: para } }),
          participantes: await tx.participanteOportunidade.count({
            where: { pessoaId: para, oportunidadeId: { notIn: jaParticipa.map((x) => x.oportunidadeId) } },
          }),
          tags: await tx.pessoaTag.count({ where: { pessoaId: para, tagId: { notIn: tagsPrincipal.map((t) => t.tagId) } } }),
          valoresCampo,
        },
        cadastroAcademico: a.moveAcademico ? { aluno: !!a.secundaria.aluno, responsavel: !!a.secundaria.responsavel } : null,
        exigeSecretaria: a.moveAcademico,
        bloqueio: a.bloqueio,
      };
    });
  });
}

/** Mescla a secundária na principal. A secundária vira lápide (`mescladaEmId`); nada é apagado e não há desfazer. */
export async function mesclarPessoas(input: EntradaMescla): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    exigirCapacidadeCrm(autor, "contatos.mesclar");
    const dados = MesclaSchema.parse(input);
    if (dados.principalId === dados.secundariaId) throw new ErroRegra("Escolha duas pessoas diferentes.");

    await prisma.$transaction(async (tx) => {
      // Ordem fixa de ids evita deadlock entre duas mesclas cruzadas.
      const ids = [dados.principalId, dados.secundariaId].sort();
      await tx.$queryRaw`SELECT id FROM "Pessoa" WHERE id IN (${ids[0]}, ${ids[1]}) ORDER BY id FOR UPDATE`;

      const { secundaria, moveAcademico, dadosPrincipal, mudados, bloqueio } = await analisarMesclaTx(tx, autor, dados);
      if (bloqueio) throw new ErroRegra(bloqueio);

      const de = dados.principalId;
      const para = dados.secundariaId;

      const contatos = await tx.contatoWhatsApp.updateMany({ where: { pessoaId: para }, data: { pessoaId: de } });
      const oportunidades = await tx.oportunidade.updateMany({ where: { pessoaId: para }, data: { pessoaId: de } });

      // Participante: único por (oportunidade, pessoa). Se a principal já participa, a linha da secundária fica
      // com ela (sem delete físico) até a lápide, mas é desligada do uso corrente movendo só as sem conflito.
      const jaParticipa = await tx.participanteOportunidade.findMany({ where: { pessoaId: de }, select: { oportunidadeId: true } });
      const participantes = await tx.participanteOportunidade.updateMany({
        where: { pessoaId: para, oportunidadeId: { notIn: jaParticipa.map((x) => x.oportunidadeId) } },
        data: { pessoaId: de },
      });

      const tagsSec = await tx.pessoaTag.findMany({ where: { pessoaId: para } });
      const tags = await tx.pessoaTag.createMany({
        data: tagsSec.map((t) => ({ pessoaId: de, tagId: t.tagId, criadoPorId: t.criadoPorId })),
        skipDuplicates: true,
      });

      // Campos personalizados: vale o da principal quando não é nulo.
      const valoresPrincipal = await tx.valorCampoPersonalizado.findMany({ where: { pessoaId: de } });
      const porCampo = new Map(valoresPrincipal.map((v) => [v.campoId, v]));
      let valoresMovidos = 0;
      for (const v of await tx.valorCampoPersonalizado.findMany({ where: { pessoaId: para } })) {
        const existente = porCampo.get(v.campoId);
        if (!existente) {
          await tx.valorCampoPersonalizado.update({ where: { id: v.id }, data: { pessoaId: de } });
          valoresMovidos++;
        } else if (existente.valor === null && v.valor !== null) {
          await tx.valorCampoPersonalizado.update({ where: { id: existente.id }, data: { valor: v.valor } });
          valoresMovidos++;
        }
      }

      // Cadastro acadêmico (D14): só com a alçada da Secretaria (conferida na análise), e cada cadastro reposto
      // ganha o seu evento, com a pessoa de antes e a de depois.
      if (moveAcademico) {
        const repontado = { pessoaIdAntes: para, pessoaIdDepois: de, via: "mescla" };
        if (secundaria.aluno) {
          await tx.aluno.update({ where: { id: secundaria.aluno.id }, data: { pessoaId: de } });
          await registrarEvento(tx, { tipo: "CadastroAcademicoRepontado", agregadoTipo: "Aluno", agregadoId: secundaria.aluno.id, autorId: autor.id, payload: repontado });
        }
        if (secundaria.responsavel) {
          await tx.responsavel.update({ where: { id: secundaria.responsavel.id }, data: { pessoaId: de } });
          await registrarEvento(tx, { tipo: "CadastroAcademicoRepontado", agregadoTipo: "Responsavel", agregadoId: secundaria.responsavel.id, autorId: autor.id, payload: repontado });
        }
      }

      if (mudados.length) await tx.pessoa.update({ where: { id: de }, data: dadosPrincipal });
      await tx.pessoa.update({ where: { id: para }, data: { mescladaEmId: de } });

      const payload = {
        principalId: de,
        secundariaId: para,
        camposDaSecundaria: mudados,
        movidos: {
          contatos: contatos.count,
          oportunidades: oportunidades.count,
          participantes: participantes.count,
          tags: tags.count,
          valoresCampo: valoresMovidos,
          cadastroAcademico: moveAcademico,
        },
      };
      for (const id of [de, para]) {
        await registrarEvento(tx, { tipo: "PessoasMescladas", agregadoTipo: "Pessoa", agregadoId: id, autorId: autor.id, payload });
      }
    });
  });
}
