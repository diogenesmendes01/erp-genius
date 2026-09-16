"use server";

import { revalidatePath } from "next/cache";
import { Papel, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import {
  exigirSessaoComPapel,
  registrarEvento,
  executarAcao,
  ErroRegra,
  ErroPermissao,
  type Resultado,
} from "@/server/_shared";
import {
  CriarUsuarioSchema,
  EditarUsuarioSchema,
  type CriarUsuarioInput,
  type EditarUsuarioInput,
} from "./schema";

const PATH = "/configuracao/usuarios";

async function validarGerente(gerenteId: string | null, usuarioId?: string, tx: Prisma.TransactionClient | typeof prisma = prisma) {
  if (!gerenteId) return;
  if (gerenteId === usuarioId) throw new ErroRegra("O gerente deve ser outra pessoa.");
  const gerente = await tx.usuario.findFirst({ where: { id: gerenteId, ativo: true, papeis: { has: Papel.GERENTE_COMERCIAL } }, select: { id: true } });
  if (!gerente) throw new ErroRegra("Selecione um gerente comercial ativo.");
}

async function bloquearUsuarios(tx: Prisma.TransactionClient, autorId: string, ids: string[]) {
  // Ordem estável evita duas edições administrativas concorrentes se bloquearem.
  await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id IN (${Prisma.join([...new Set([autorId, ...ids])])}) ORDER BY id FOR UPDATE`;
  const autor = await tx.usuario.findUnique({ where: { id: autorId }, select: { ativo: true, papeis: true } });
  if (!autor?.ativo || !autor.papeis.includes(Papel.ADMINISTRADOR)) throw new ErroPermissao();
}

export async function criarUsuario(input: CriarUsuarioInput): Promise<Resultado<{ id: string }>> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.ADMINISTRADOR);
    const dados = CriarUsuarioSchema.parse(input);
    await validarGerente(dados.gerenteComercialId);

    const existe = await prisma.usuario.findUnique({ where: { email: dados.email } });
    if (existe) throw new ErroRegra("Já existe usuário com esse e-mail.");

    const senhaHash = await bcrypt.hash(dados.senha, 10);
    const id = await prisma.$transaction(async (tx) => {
      await bloquearUsuarios(tx, autor.id, dados.gerenteComercialId ? [dados.gerenteComercialId] : []);
      await validarGerente(dados.gerenteComercialId, undefined, tx);
      const u = await tx.usuario.create({
        data: {
          nome: dados.nome,
          email: dados.email,
          senhaHash,
          papeis: dados.papeis,
          limiteDescontoPct: dados.limiteDescontoPct,
          limiteDescontoTaxaPct: dados.limiteDescontoTaxaPct,
          limiteDescontoMensalidadePct: dados.limiteDescontoMensalidadePct,
          alcadaAlteradaEm: new Date(),
          permissoes: dados.permissoes,
          gerenteComercialId: dados.gerenteComercialId,
        },
      });
      await registrarEvento(tx, {
        tipo: "UsuarioCriado",
        agregadoTipo: "Usuario",
        agregadoId: u.id,
        autorId: autor.id,
        payload: { nome: u.nome, email: u.email, papeis: dados.papeis, permissoes: dados.permissoes, gerenteComercialId: dados.gerenteComercialId, limiteTaxa: dados.limiteDescontoTaxaPct, limiteMensalidade: dados.limiteDescontoMensalidadePct },
      });
      return u.id;
    });

    revalidatePath(PATH);
    return { id };
  });
}

export async function editarUsuario(id: string, input: EditarUsuarioInput): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.ADMINISTRADOR);
    const dados = EditarUsuarioSchema.parse(input);
    const senhaHash = dados.senha ? await bcrypt.hash(dados.senha, 10) : undefined;

    await prisma.$transaction(async (tx) => {
      await bloquearUsuarios(tx, autor.id, [id, ...(dados.gerenteComercialId ? [dados.gerenteComercialId] : [])]);
      const atual = await tx.usuario.findUnique({ where: { id } });
      if (!atual) throw new ErroRegra("Usuário não encontrado.");
      await validarGerente(dados.gerenteComercialId, id, tx);
      const alcadaMudou = Number(atual.limiteDescontoTaxaPct ?? 0) !== Number(dados.limiteDescontoTaxaPct ?? 0)
        || Number(atual.limiteDescontoMensalidadePct ?? 0) !== Number(dados.limiteDescontoMensalidadePct ?? 0);
      const papeisAdicionados = dados.papeis.some((p) => !atual.papeis.includes(p));
      const permissoesAdicionadas = dados.permissoes.some((p) => !atual.permissoes.includes(p));
      const aumentouAlcada = Number(dados.limiteDescontoTaxaPct ?? 0) > Number(atual.limiteDescontoTaxaPct ?? 0)
        || Number(dados.limiteDescontoMensalidadePct ?? 0) > Number(atual.limiteDescontoMensalidadePct ?? 0);
      if (id === autor.id && (aumentouAlcada || papeisAdicionados || permissoesAdicionadas)) {
        throw new ErroRegra("Outro administrador deve conceder aumento das suas permissões ou alçadas.");
      }
      if (id === autor.id && !dados.papeis.includes(Papel.ADMINISTRADOR)) {
        throw new ErroRegra("Peça a outro administrador para alterar seu papel de administrador.");
      }

      if (dados.email !== atual.email) {
        const colide = await tx.usuario.findUnique({ where: { email: dados.email } });
        if (colide) throw new ErroRegra("Já existe usuário com esse e-mail.");
      }

      await tx.usuario.update({
        where: { id },
        data: {
          nome: dados.nome,
          email: dados.email,
          papeis: dados.papeis,
          limiteDescontoPct: dados.limiteDescontoPct,
          limiteDescontoTaxaPct: dados.limiteDescontoTaxaPct,
          limiteDescontoMensalidadePct: dados.limiteDescontoMensalidadePct,
          ...(alcadaMudou ? { alcadaAlteradaEm: new Date() } : {}),
          permissoes: dados.permissoes,
          gerenteComercialId: dados.gerenteComercialId,
          ...(senhaHash ? { senhaHash } : {}),
        },
      });
      await registrarEvento(tx, {
        tipo: "UsuarioEditado",
        agregadoTipo: "Usuario",
        agregadoId: id,
        autorId: autor.id,
        payload: {
          de: { nome: atual.nome, papeis: atual.papeis, permissoes: atual.permissoes, gerenteComercialId: atual.gerenteComercialId, limiteTaxa: atual.limiteDescontoTaxaPct?.toString() ?? null, limiteMensalidade: atual.limiteDescontoMensalidadePct?.toString() ?? null },
          para: { nome: dados.nome, papeis: dados.papeis, permissoes: dados.permissoes, gerenteComercialId: dados.gerenteComercialId, limiteTaxa: dados.limiteDescontoTaxaPct, limiteMensalidade: dados.limiteDescontoMensalidadePct },
          senhaAlterada: !!senhaHash,
        },
      });
    });

    revalidatePath(PATH);
  });
}

export async function alternarUsuarioAtivo(id: string): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.ADMINISTRADOR);
    await prisma.$transaction(async (tx) => {
      await bloquearUsuarios(tx, autor.id, [id]);
      const usuario = await tx.usuario.findUnique({ where: { id } });
      if (!usuario) throw new ErroRegra("Usuário não encontrado.");
      if (id === autor.id && usuario.ativo) throw new ErroRegra("Você não pode desativar a si mesmo.");
      await tx.usuario.update({ where: { id }, data: { ativo: !usuario.ativo } });
      await registrarEvento(tx, {
        tipo: usuario.ativo ? "UsuarioDesativado" : "UsuarioAtivado",
        agregadoTipo: "Usuario",
        agregadoId: id,
        autorId: autor.id,
        payload: { de: usuario.ativo, para: !usuario.ativo },
      });
    });

    revalidatePath(PATH);
  });
}
