import { AlvoCampoPersonalizado, CorTag, Papel, TipoCampoPersonalizado } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ChaveIdempotenciaSchema, ErroRegra, executarAcao, exigirSessaoComPapel, registrarEvento, type Resultado } from "@/server/_shared";
import { marcaIdempotencia, repeticaoIdempotente, ultimoEventoDoAutor } from "@/server/_shared/idempotencia";

// Idempotência só na criação (#166): a chave vai no Evento de criação (`TagSalva`/`CampoSalvo` com `de: null`);
// na edição (com `id`) ela é ignorada.
const MSG_CONFLITO = "Esta tentativa já foi usada com outros dados. Recarregue a página e confira se o item já aparece antes de repetir.";

export type TipoCampo = TipoCampoPersonalizado;
export type AlvoCampo = AlvoCampoPersonalizado;

/** Chave de comparação do nome: sem acento, sem caixa, espaços colapsados. */
export function chaveNome(nome: string): string {
  return nome.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
}

const TagSchema = z.object({
  id: z.string().trim().min(1).optional(),
  nome: z.string().trim().min(1, "Informe o nome.").max(60),
  grupo: z.string().trim().min(1, "Informe o grupo.").max(60),
  cor: z.nativeEnum(CorTag),
  chaveIdempotencia: ChaveIdempotenciaSchema.optional(),
});

export async function salvarTag(i: { id?: string; nome: string; grupo: string; cor: CorTag; chaveIdempotencia?: string }): Promise<Resultado<{ id: string }>> {
  return executarAcao(async () => {
    const { chaveIdempotencia, ...d } = TagSchema.parse(i);
    const autor = await exigirSessaoComPapel(Papel.ADMINISTRADOR, Papel.GERENTE_COMERCIAL);
    const marca = d.id ? null : marcaIdempotencia(chaveIdempotencia, d);
    return prisma.$transaction(async (tx) => {
      if (marca) {
        const repetido = await repeticaoIdempotente(tx, { tipo: "TagSalva", agregadoTipo: "Tag", autorId: autor.id, marca, mensagemConflito: MSG_CONFLITO });
        if (repetido) return { id: repetido.agregadoId };
      }
      const todas = await tx.tag.findMany();
      const chave = chaveNome(d.nome);
      if (todas.some((t) => t.id !== d.id && chaveNome(t.nome) === chave)) throw new ErroRegra("Já existe uma tag com este nome.");
      const antes = d.id ? todas.find((t) => t.id === d.id) : undefined;
      if (d.id && !antes) throw new ErroRegra("Tag não encontrada.");
      if (antes && !antes.ativo) throw new ErroRegra("Tag arquivada não pode ser editada.");
      // Edição sem mudança (ex.: reenvio após resultado incerto): sem update nem Evento.
      if (antes && antes.nome === d.nome && antes.grupo === d.grupo && antes.cor === d.cor) return { id: antes.id };
      const tag = antes
        ? await tx.tag.update({ where: { id: antes.id }, data: { nome: d.nome, grupo: d.grupo, cor: d.cor } })
        : await tx.tag.create({ data: { nome: d.nome, grupo: d.grupo, cor: d.cor } });
      await registrarEvento(tx, {
        tipo: "TagSalva", agregadoTipo: "Tag", agregadoId: tag.id, autorId: autor.id,
        payload: { de: antes ? { nome: antes.nome, grupo: antes.grupo, cor: antes.cor } : null, para: { nome: tag.nome, grupo: tag.grupo, cor: tag.cor }, ...marca },
      });
      return { id: tag.id };
    });
  });
}

export async function arquivarTag(id: string): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.ADMINISTRADOR, Papel.GERENTE_COMERCIAL);
    await prisma.$transaction(async (tx) => {
      // Idempotência por natureza (#166, 5º lote): a linha travada serializa o clique duplo, e a tag já arquivada
      // por quem repete devolve ok sem outro Evento. Arquivada por outra pessoa, segue recusada.
      const [tag] = await tx.$queryRaw<{ ativo: boolean }[]>`SELECT ativo FROM "Tag" WHERE id = ${id} FOR UPDATE`;
      if (!tag) throw new ErroRegra("Tag não encontrada.");
      if (!tag.ativo) {
        if (await ultimoEventoDoAutor(tx, { tipo: "TagArquivada", agregadoTipo: "Tag", agregadoId: id, autorId: autor.id })) return;
        throw new ErroRegra("Tag já arquivada.");
      }
      await tx.tag.update({ where: { id }, data: { ativo: false } });
      await registrarEvento(tx, {
        tipo: "TagArquivada", agregadoTipo: "Tag", agregadoId: id, autorId: autor.id,
        payload: { de: { ativo: true }, para: { ativo: false } },
      });
    });
    return undefined;
  });
}

const CampoSchema = z.object({
  id: z.string().trim().min(1).optional(),
  nome: z.string().trim().min(1, "Informe o nome.").max(80),
  tipo: z.nativeEnum(TipoCampoPersonalizado),
  opcoes: z.array(z.string().trim().min(1).max(80)).max(50),
  alvo: z.nativeEnum(AlvoCampoPersonalizado),
  obrigatorio: z.boolean(),
  chaveIdempotencia: ChaveIdempotenciaSchema.optional(),
});

export async function salvarCampo(i: { id?: string; nome: string; tipo: TipoCampo; opcoes: string[]; alvo: AlvoCampo; obrigatorio: boolean; chaveIdempotencia?: string }): Promise<Resultado<{ id: string }>> {
  return executarAcao(async () => {
    const { chaveIdempotencia, ...d } = CampoSchema.parse(i);
    const autor = await exigirSessaoComPapel(Papel.ADMINISTRADOR, Papel.GERENTE_COMERCIAL);
    const opcoes: string[] = [];
    if (d.tipo === "SELECAO") {
      const vistas = new Set<string>();
      for (const o of d.opcoes) if (!vistas.has(chaveNome(o))) { vistas.add(chaveNome(o)); opcoes.push(o); }
      if (opcoes.length === 0) throw new ErroRegra("Campo de lista precisa de ao menos uma opção.");
    }
    const marca = d.id ? null : marcaIdempotencia(chaveIdempotencia, { ...d, opcoes });
    return prisma.$transaction(async (tx) => {
      if (marca) {
        const repetido = await repeticaoIdempotente(tx, { tipo: "CampoSalvo", agregadoTipo: "CampoPersonalizado", autorId: autor.id, marca, mensagemConflito: MSG_CONFLITO });
        if (repetido) return { id: repetido.agregadoId };
      }
      const todos = await tx.campoPersonalizado.findMany({ where: { alvo: d.alvo } });
      const chave = chaveNome(d.nome);
      if (todos.some((c) => c.id !== d.id && chaveNome(c.nome) === chave)) throw new ErroRegra("Já existe um campo com este nome para este alvo.");
      const antes = d.id ? await tx.campoPersonalizado.findUnique({ where: { id: d.id } }) : null;
      if (d.id && !antes) throw new ErroRegra("Campo não encontrado.");
      if (antes?.arquivadoEm) throw new ErroRegra("Campo arquivado não pode ser editado.");
      if (antes && (antes.tipo !== d.tipo || antes.alvo !== d.alvo)) {
        const usados = await tx.valorCampoPersonalizado.count({ where: { campoId: antes.id } });
        if (usados > 0) throw new ErroRegra("Este campo já tem valores preenchidos: não é possível trocar o tipo nem o alvo.");
      }
      const dados = { nome: d.nome, tipo: d.tipo, alvo: d.alvo, opcoes, obrigatorio: d.obrigatorio };
      const resumo = (c: typeof dados) => ({ nome: c.nome, tipo: c.tipo, alvo: c.alvo, opcoes: c.opcoes, obrigatorio: c.obrigatorio });
      // Edição sem mudança (ex.: reenvio após resultado incerto): sem update nem Evento.
      if (antes && JSON.stringify(resumo(antes)) === JSON.stringify(resumo(dados))) return { id: antes.id };
      const campo = antes
        ? await tx.campoPersonalizado.update({ where: { id: antes.id }, data: dados })
        : await tx.campoPersonalizado.create({ data: dados });
      await registrarEvento(tx, {
        tipo: "CampoSalvo", agregadoTipo: "CampoPersonalizado", agregadoId: campo.id, autorId: autor.id,
        payload: { de: antes ? resumo(antes) : null, para: resumo(campo), ...marca },
      });
      return { id: campo.id };
    });
  });
}

/** Arquivar não apaga valores: o campo some das listas de seleção, mas os registros antigos o mantêm. */
export async function arquivarCampo(id: string, confirmacao: string): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.ADMINISTRADOR, Papel.GERENTE_COMERCIAL);
    await prisma.$transaction(async (tx) => {
      // Idempotência por natureza (#166, 5º lote): como em `arquivarTag`. O reenvio também confere a
      // confirmação: com outro nome, segue recusado.
      const [campo] = await tx.$queryRaw<{ nome: string; arquivadoEm: Date | null }[]>`SELECT nome, "arquivadoEm" FROM "CampoPersonalizado" WHERE id = ${id} FOR UPDATE`;
      if (!campo) throw new ErroRegra("Campo não encontrado.");
      if (campo.arquivadoEm) {
        if (confirmacao.trim() === campo.nome && await ultimoEventoDoAutor(tx, { tipo: "CampoArquivado", agregadoTipo: "CampoPersonalizado", agregadoId: id, autorId: autor.id })) return;
        throw new ErroRegra("Campo já arquivado.");
      }
      if (confirmacao.trim() !== campo.nome) throw new ErroRegra("Digite o nome do campo exatamente para confirmar.");
      const agora = new Date();
      await tx.campoPersonalizado.update({ where: { id }, data: { arquivadoEm: agora } });
      await registrarEvento(tx, {
        tipo: "CampoArquivado", agregadoTipo: "CampoPersonalizado", agregadoId: id, autorId: autor.id,
        payload: { de: { arquivadoEm: null }, para: { arquivadoEm: agora.toISOString() } },
      });
    });
    return undefined;
  });
}
