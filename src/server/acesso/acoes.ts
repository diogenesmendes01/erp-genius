"use server";

import { revalidatePath } from "next/cache";
import { Papel } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import {
  exigirSessaoComPapel,
  registrarEvento,
  executarAcao,
  ErroRegra,
  type Resultado,
} from "@/server/_shared";
import {
  CriarUsuarioSchema,
  EditarUsuarioSchema,
  type CriarUsuarioInput,
  type EditarUsuarioInput,
} from "./schema";

const PATH = "/configuracao/usuarios";

export async function criarUsuario(input: CriarUsuarioInput): Promise<Resultado<{ id: string }>> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.ADMINISTRADOR);
    const dados = CriarUsuarioSchema.parse(input);

    const existe = await prisma.usuario.findUnique({ where: { email: dados.email } });
    if (existe) throw new ErroRegra("Já existe usuário com esse e-mail.");

    const senhaHash = await bcrypt.hash(dados.senha, 10);
    const id = await prisma.$transaction(async (tx) => {
      const u = await tx.usuario.create({
        data: {
          nome: dados.nome,
          email: dados.email,
          senhaHash,
          papeis: dados.papeis,
          limiteDescontoPct: dados.limiteDescontoPct,
        },
      });
      await registrarEvento(tx, {
        tipo: "UsuarioCriado",
        agregadoTipo: "Usuario",
        agregadoId: u.id,
        autorId: autor.id,
        payload: { nome: u.nome, email: u.email, papeis: dados.papeis },
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

    const atual = await prisma.usuario.findUnique({ where: { id } });
    if (!atual) throw new ErroRegra("Usuário não encontrado.");

    if (dados.email !== atual.email) {
      const colide = await prisma.usuario.findUnique({ where: { email: dados.email } });
      if (colide) throw new ErroRegra("Já existe usuário com esse e-mail.");
    }

    const senhaHash = dados.senha ? await bcrypt.hash(dados.senha, 10) : undefined;

    await prisma.$transaction(async (tx) => {
      await tx.usuario.update({
        where: { id },
        data: {
          nome: dados.nome,
          email: dados.email,
          papeis: dados.papeis,
          limiteDescontoPct: dados.limiteDescontoPct,
          ...(senhaHash ? { senhaHash } : {}),
        },
      });
      await registrarEvento(tx, {
        tipo: "UsuarioEditado",
        agregadoTipo: "Usuario",
        agregadoId: id,
        autorId: autor.id,
        payload: {
          de: { nome: atual.nome, papeis: atual.papeis },
          para: { nome: dados.nome, papeis: dados.papeis },
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
    const usuario = await prisma.usuario.findUnique({ where: { id } });
    if (!usuario) throw new ErroRegra("Usuário não encontrado.");
    if (id === autor.id && usuario.ativo)
      throw new ErroRegra("Você não pode desativar a si mesmo.");

    await prisma.$transaction(async (tx) => {
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
