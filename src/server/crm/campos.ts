import { Papel, Prisma, type AlvoCampoPersonalizado, type TipoCampoPersonalizado } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { registrarEvento } from "@/server/_shared/evento";
import { executarAcao, type Resultado } from "@/server/_shared/resultado";
import { ErroRegra, exigirPapel, exigirSessao } from "@/server/_shared/sessao";
import { exigirCapacidadeCrm } from "./permissoes";
import { escopoPessoas } from "./pessoas";
import { escopoEmpresas } from "./tags";

export type ValorCampo = string | number | boolean | null;
type DefinicaoCampo = { tipo: TipoCampoPersonalizado; opcoes: string[]; obrigatorio: boolean };
export type ResultadoValidacao = { ok: true; valor: ValorCampo } | { ok: false; erro: string };

const MAX_TEXTO = 500;

function vazio(valor: unknown): boolean {
  return valor === null || valor === undefined || (typeof valor === "string" && valor.trim() === "");
}

function dataValida(texto: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
  if (!m) return false;
  const [a, mes, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(a, mes - 1, d));
  return dt.getUTCFullYear() === a && dt.getUTCMonth() === mes - 1 && dt.getUTCDate() === d;
}

/** Valida e normaliza o valor de um campo personalizado conforme o tipo. Vazio vira `null` (ou erro, se obrigatório). */
export function validarValorCampo(campo: DefinicaoCampo, valor: unknown): ResultadoValidacao {
  // Para BOOLEANO, `false` é um valor; só null/undefined/"" contam como vazio.
  if (vazio(valor)) {
    return campo.obrigatorio ? { ok: false, erro: "Campo obrigatório." } : { ok: true, valor: null };
  }
  switch (campo.tipo) {
    case "NUMERO": {
      if (typeof valor === "number") return Number.isFinite(valor) ? { ok: true, valor } : { ok: false, erro: "Número inválido." };
      const t = typeof valor === "string" ? valor.trim().replace(",", ".") : "";
      if (!/^-?\d+(\.\d+)?$/.test(t)) return { ok: false, erro: "Número inválido." };
      const n = Number(t);
      return Number.isFinite(n) ? { ok: true, valor: n } : { ok: false, erro: "Número inválido." };
    }
    case "DATA": {
      const t = typeof valor === "string" ? valor.trim() : "";
      return dataValida(t) ? { ok: true, valor: t } : { ok: false, erro: "Data inválida." };
    }
    case "SELECAO": {
      const t = typeof valor === "string" ? valor.trim() : "";
      return campo.opcoes.includes(t) ? { ok: true, valor: t } : { ok: false, erro: "Escolha uma das opções." };
    }
    case "BOOLEANO": {
      if (typeof valor === "boolean") return { ok: true, valor };
      if (valor === "true") return { ok: true, valor: true };
      if (valor === "false") return { ok: true, valor: false };
      return { ok: false, erro: "Valor inválido." };
    }
    case "TEXTO": {
      if (typeof valor !== "string") return { ok: false, erro: "Valor inválido." };
      const t = valor.trim();
      return t.length > MAX_TEXTO ? { ok: false, erro: `O texto deve ter até ${MAX_TEXTO} caracteres.` } : { ok: true, valor: t };
    }
  }
}

const TIPOS = ["TEXTO", "NUMERO", "DATA", "SELECAO", "BOOLEANO"] as const;
const ALVOS = ["PESSOA", "EMPRESA"] as const;

const CampoSchema = z.object({
  id: z.string().min(1).optional(),
  nome: z.string().trim().min(1, "Informe o nome do campo.").max(60, "O nome do campo deve ter até 60 caracteres."),
  tipo: z.enum(TIPOS, { errorMap: () => ({ message: "Escolha um tipo válido." }) }),
  alvo: z.enum(ALVOS, { errorMap: () => ({ message: "Escolha onde o campo se aplica." }) }),
  opcoes: z.array(z.string()).optional(),
  obrigatorio: z.boolean().optional(),
});

export async function salvarCampoPersonalizado(input: {
  id?: string;
  nome: string;
  tipo: TipoCampoPersonalizado;
  alvo: AlvoCampoPersonalizado;
  opcoes?: string[];
  obrigatorio?: boolean;
}): Promise<Resultado<{ id: string }>> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    exigirPapel(autor, Papel.ADMINISTRADOR);
    const dados = CampoSchema.parse(input);
    const opcoes =
      dados.tipo === "SELECAO" ? [...new Set((dados.opcoes ?? []).map((o) => o.trim()).filter(Boolean))] : [];
    if (dados.tipo === "SELECAO" && opcoes.length === 0) throw new ErroRegra("Adicione pelo menos uma opção.");
    const obrigatorio = dados.obrigatorio ?? false;

    return prisma.$transaction(async (tx) => {
      const igual = await tx.campoPersonalizado.findUnique({
        where: { alvo_nome: { alvo: dados.alvo, nome: dados.nome } },
        select: { id: true },
      });
      if (igual && igual.id !== dados.id) throw new ErroRegra("Já existe um campo com este nome.");

      if (!dados.id) {
        const campo = await tx.campoPersonalizado.create({
          data: { nome: dados.nome, tipo: dados.tipo, alvo: dados.alvo, opcoes, obrigatorio },
        });
        await registrarEvento(tx, {
          tipo: "CampoPersonalizadoSalvo",
          agregadoTipo: "CampoPersonalizado",
          agregadoId: campo.id,
          autorId: autor.id,
          payload: { criado: true, nome: campo.nome, tipo: campo.tipo, alvo: campo.alvo, opcoes, obrigatorio },
        });
        return { id: campo.id };
      }

      const atual = await tx.campoPersonalizado.findUnique({ where: { id: dados.id } });
      if (!atual) throw new ErroRegra("Campo não encontrado.");
      if (atual.tipo !== dados.tipo || atual.alvo !== dados.alvo) {
        const comValor = await tx.valorCampoPersonalizado.count({ where: { campoId: atual.id } });
        if (comValor > 0) throw new ErroRegra("Este campo já tem valores; crie um campo novo.");
      }
      await tx.campoPersonalizado.update({
        where: { id: atual.id },
        data: { nome: dados.nome, tipo: dados.tipo, alvo: dados.alvo, opcoes, obrigatorio },
      });
      await registrarEvento(tx, {
        tipo: "CampoPersonalizadoSalvo",
        agregadoTipo: "CampoPersonalizado",
        agregadoId: atual.id,
        autorId: autor.id,
        payload: {
          criado: false,
          de: { nome: atual.nome, tipo: atual.tipo, alvo: atual.alvo, opcoes: atual.opcoes, obrigatorio: atual.obrigatorio },
          para: { nome: dados.nome, tipo: dados.tipo, alvo: dados.alvo, opcoes, obrigatorio },
        },
      });
      return { id: atual.id };
    });
  });
}

const ValorSchema = z.object({
  campoId: z.string().min(1, "Escolha o campo."),
  pessoaId: z.string().min(1).optional(),
  empresaId: z.string().min(1).optional(),
});

export async function definirValorCampo(input: {
  campoId: string;
  pessoaId?: string;
  empresaId?: string;
  valor: unknown;
}): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    exigirCapacidadeCrm(autor, "contatos.editar");
    const dados = ValorSchema.parse(input);
    if (!!dados.pessoaId === !!dados.empresaId) throw new ErroRegra("Informe a pessoa ou a empresa, e não as duas.");

    await prisma.$transaction(async (tx) => {
      const campo = await tx.campoPersonalizado.findUnique({ where: { id: dados.campoId } });
      if (!campo) throw new ErroRegra("Campo não encontrado.");
      if (campo.arquivadoEm) throw new ErroRegra("Este campo está arquivado.");
      const alvo: AlvoCampoPersonalizado = dados.pessoaId ? "PESSOA" : "EMPRESA";
      if (campo.alvo !== alvo) {
        throw new ErroRegra(campo.alvo === "PESSOA" ? "Este campo é de pessoa." : "Este campo é de empresa.");
      }

      const validado = validarValorCampo(campo, input.valor);
      if (!validado.ok) throw new ErroRegra(validado.erro);

      const dono = dados.pessoaId
        ? { pessoaId: dados.pessoaId }
        : { empresaId: dados.empresaId! };
      if (dados.pessoaId) {
        const visivel = await tx.pessoa.findFirst({
          where: { AND: [{ id: dados.pessoaId }, await escopoPessoas(autor, tx)] },
          select: { id: true },
        });
        if (!visivel) throw new ErroRegra("Pessoa não encontrada.");
      } else {
        const visivel = await tx.empresa.findFirst({
          where: { AND: [{ id: dados.empresaId! }, await escopoEmpresas(autor, tx)] },
          select: { id: true },
        });
        if (!visivel) throw new ErroRegra("Empresa não encontrada.");
      }

      const existente = await tx.valorCampoPersonalizado.findFirst({ where: { campoId: campo.id, ...dono } });
      const de = (existente?.valor ?? null) as ValorCampo;
      const para = validado.valor;
      if (de === para) return; // idempotente: sem Evento

      const json: Prisma.InputJsonValue | typeof Prisma.JsonNull = para === null ? Prisma.JsonNull : para;
      if (existente) {
        await tx.valorCampoPersonalizado.update({ where: { id: existente.id }, data: { valor: json } });
      } else {
        await tx.valorCampoPersonalizado.create({ data: { campoId: campo.id, ...dono, valor: json } });
      }
      await registrarEvento(tx, {
        tipo: "CampoPersonalizadoAlterado",
        agregadoTipo: dados.pessoaId ? "Pessoa" : "Empresa",
        agregadoId: dados.pessoaId ?? dados.empresaId!,
        autorId: autor.id,
        payload: { campoId: campo.id, nome: campo.nome, de, para },
      });
    });
  });
}
