"use server";

import { readFile } from "node:fs/promises";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Papel, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolverCaminhoUpload } from "@/lib/uploads";
import { ErroRegra, executarAcao, exigirSessaoComPapel, registrarEvento, type Resultado } from "@/server/_shared";
import { exigirMotorConectado } from "@/server/whatsapp/motor/capacidades";
import { ErroMotor } from "@/server/whatsapp/motor/cliente";
import {
  ErroMotorParcial,
  MSG_RECURSO_INDISPONIVEL,
  SEGUNDOS_TEMPORARIAS,
  clienteMotorNumero,
  type ClienteMotorNumero,
  type PrivacidadeNumero,
  type SegundosTemporarias,
  type Visibilidade,
} from "@/server/whatsapp/motor/numero";

// Perfil, privacidade e mensagens temporárias do número: só ADMINISTRADOR. O motor é chamado
// PRIMEIRO; o ERP só grava (e só emite Evento) se o motor aceitar. `deps.motor` injeta o cliente.

export interface DepsNumero {
  motor?: ClienteMotorNumero;
}

const FRASE_TEMPORARIAS = "ativar temporárias";
/** Limite do motor (bytes decodificados): acima disso o `profile.picture` é recusado. */
const MAX_FOTO_BYTES = 128 * 1024;
const MSG_FOTO_GRANDE = "A foto pode ter no máximo 128 KB. Reduza a imagem e tente de novo.";
const MIMES_FOTO = ["image/jpeg", "image/png"];
const VISIBILIDADE = z.enum(["TODOS", "CONTATOS", "NINGUEM"], { message: "Visibilidade inválida." });

const PerfilSchema = z.object({
  numeroId: z.string().trim().min(1),
  nome: z.string().trim().min(1, "O nome do perfil precisa ter de 1 a 25 caracteres.").max(25, "O nome do perfil pode ter no máximo 25 caracteres.").optional(),
  recado: z.string().max(139, "O recado pode ter no máximo 139 caracteres.").optional(),
  fotoUploadId: z.string().trim().min(1).optional(),
});

const PrivacidadeSchema = z.object({
  numeroId: z.string().trim().min(1),
  privacidade: z.object({ vistoPorUltimo: VISIBILIDADE, foto: VISIBILIDADE, recado: VISIBILIDADE, grupos: VISIBILIDADE }),
});

const TemporariasSchema = z.object({
  numeroId: z.string().trim().min(1),
  segundos: z.number().refine((n): n is SegundosTemporarias => (SEGUNDOS_TEMPORARIAS as readonly number[]).includes(n), "Duração inválida."),
  confirmacao: z.string(),
});

function cliente(deps?: DepsNumero): ClienteMotorNumero {
  const c = deps?.motor ?? clienteMotorNumero;
  return c;
}

async function carregarNumero(id: string) {
  const n = await prisma.numeroWhatsApp.findUnique({
    where: { id },
    select: { id: true, driver: true, ativo: true, sessao: true, providerRef: true, perfilNome: true, perfilRecado: true, perfilFotoUploadId: true, privacidade: true, temporariasSegundos: true },
  });
  if (!n) throw new ErroRegra("Número não encontrado.");
  exigirMotorConectado(n);
  return { ...n, ref: n.providerRef ?? n.id };
}

const MSG_MOTOR_FALHOU = "O motor do WhatsApp não aplicou a mudança. Nada foi salvo; tente de novo em instantes.";

/**
 * Chama o motor e traduz a falha: nada é gravado no ERP quando isto lança. `ErroMotorParcial`
 * passa adiante para o chamador gravar só a parte que o motor já aplicou.
 */
async function noMotor(fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (e) {
    if (e instanceof ErroMotorParcial) throw e;
    if (e instanceof ErroMotor) {
      if (e.codigo === "ACAO_NAO_DISPONIVEL") throw new ErroRegra(MSG_RECURSO_INDISPONIVEL);
      throw new ErroRegra(MSG_MOTOR_FALHOU);
    }
    if (e instanceof ErroRegra) throw e;
    throw new ErroRegra(MSG_MOTOR_FALHOU);
  }
}

async function lerFoto(uploadId: string): Promise<string> {
  const reg = await prisma.registroUpload.findUnique({ where: { id: uploadId }, select: { url: true, mime: true, tamanho: true } });
  if (!reg) throw new ErroRegra("Foto não encontrada. Envie a imagem de novo.");
  if (!MIMES_FOTO.includes(reg.mime)) throw new ErroRegra("A foto precisa ser JPEG ou PNG.");
  if (reg.tamanho > MAX_FOTO_BYTES) throw new ErroRegra(MSG_FOTO_GRANDE);
  const caminho = resolverCaminhoUpload([reg.url.split("/").at(-1) ?? ""]);
  if (!caminho) throw new ErroRegra("Foto não encontrada. Envie a imagem de novo.");
  let bytes: Buffer;
  try {
    bytes = await readFile(caminho);
  } catch {
    throw new ErroRegra("Foto não encontrada. Envie a imagem de novo.");
  }
  if (bytes.length > MAX_FOTO_BYTES) throw new ErroRegra(MSG_FOTO_GRANDE);
  return `data:${reg.mime};base64,${bytes.toString("base64")}`;
}

/** Converte o RegistroUpload recém-enviado (`/api/upload` devolve a URL) no id usado por `atualizarPerfilNumero`. */
export async function uploadIdPorUrl(url: string): Promise<Resultado<{ id: string }>> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.ADMINISTRADOR);
    const reg = await prisma.registroUpload.findFirst({ where: { url, autorId: autor.id }, select: { id: true } });
    if (!reg) throw new ErroRegra("Arquivo enviado não encontrado.");
    return { id: reg.id };
  });
}

export async function atualizarPerfilNumero(
  i: { numeroId: string; nome?: string; recado?: string; fotoUploadId?: string },
  deps?: DepsNumero,
): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.ADMINISTRADOR);
    const d = PerfilSchema.parse(i);
    if (d.nome === undefined && d.recado === undefined && d.fotoUploadId === undefined) throw new ErroRegra("Nada para alterar no perfil.");
    const n = await carregarNumero(d.numeroId);
    const fotoDataUri = d.fotoUploadId ? await lerFoto(d.fotoUploadId) : undefined;
    let parcial = false;
    try {
      await noMotor(() => cliente(deps).atualizarPerfil(n.ref, { nome: d.nome, recado: d.recado, fotoDataUri }));
    } catch (e) {
      if (!(e instanceof ErroMotorParcial)) throw e;
      parcial = true; // a foto já está no motor; nome e recado não
    }
    await prisma.$transaction(async (tx) => {
      const antes = { nome: n.perfilNome, recado: n.perfilRecado, fotoUploadId: n.perfilFotoUploadId };
      const depois = {
        nome: parcial ? n.perfilNome : d.nome ?? n.perfilNome,
        recado: parcial ? n.perfilRecado : d.recado ?? n.perfilRecado,
        fotoUploadId: d.fotoUploadId ?? n.perfilFotoUploadId,
      };
      await tx.numeroWhatsApp.update({ where: { id: n.id }, data: { perfilNome: depois.nome, perfilRecado: depois.recado, perfilFotoUploadId: depois.fotoUploadId } });
      await registrarEvento(tx, { tipo: "NumeroPerfilAlterado", agregadoTipo: "NumeroWhatsApp", agregadoId: n.id, autorId: autor.id, payload: { de: antes, para: depois, ...(parcial ? { parcial: true } : {}) } });
    });
    revalidatePath("/configuracao/whatsapp", "layout");
    if (parcial) throw new ErroRegra("A foto foi aplicada e salva, mas o motor não aplicou o nome e o recado. Tente salvar de novo.");
    return undefined;
  });
}

/** Confirmação de leitura não é configurável (é automática, doc 03). */
export async function atualizarPrivacidadeNumero(
  i: { numeroId: string; privacidade: { vistoPorUltimo: Visibilidade; foto: Visibilidade; recado: Visibilidade; grupos: Visibilidade } },
  deps?: DepsNumero,
): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.ADMINISTRADOR);
    const d = PrivacidadeSchema.parse(i);
    if (d.privacidade.grupos === "NINGUEM") throw new ErroRegra("Quem pode adicionar o número a grupos só aceita \"Todos\" ou \"Contatos\".");
    const n = await carregarNumero(d.numeroId);
    const atual = (n.privacidade ?? null) as Partial<PrivacidadeNumero> | null;
    const mudou: Partial<PrivacidadeNumero> = {};
    for (const k of ["vistoPorUltimo", "foto", "recado", "grupos"] as const) if (atual?.[k] !== d.privacidade[k]) mudou[k] = d.privacidade[k];
    if (Object.keys(mudou).length === 0) return undefined;
    let para: Partial<PrivacidadeNumero> = d.privacidade;
    let parcial = false;
    try {
      await noMotor(() => cliente(deps).atualizarPrivacidade(n.ref, mudou));
    } catch (e) {
      if (!(e instanceof ErroMotorParcial)) throw e;
      // Grava só o que o motor já aplicou: o resto continua como estava.
      parcial = true;
      para = { ...(atual ?? {}), ...(e.aplicado.privacidade ?? {}) };
    }
    await prisma.$transaction(async (tx) => {
      await tx.numeroWhatsApp.update({ where: { id: n.id }, data: { privacidade: para as Prisma.InputJsonValue } });
      await registrarEvento(tx, { tipo: "NumeroPrivacidadeAlterada", agregadoTipo: "NumeroWhatsApp", agregadoId: n.id, autorId: autor.id, payload: { de: atual, para, ...(parcial ? { parcial: true } : {}) } });
    });
    revalidatePath("/configuracao/whatsapp", "layout");
    if (parcial) throw new ErroRegra("O motor aplicou só parte da privacidade; essa parte foi salva. Tente salvar de novo para o restante.");
    return undefined;
  });
}

/** Desligadas por padrão. Ligar exige digitar a frase de confirmação; desligar preserva histórico e auditoria. */
export async function definirTemporariasNumero(
  i: { numeroId: string; segundos: 0 | 86400 | 604800 | 7776000; confirmacao: string },
  deps?: DepsNumero,
): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.ADMINISTRADOR);
    const d = TemporariasSchema.parse(i);
    if (d.segundos > 0 && d.confirmacao.trim().toLowerCase() !== FRASE_TEMPORARIAS) throw new ErroRegra(`Digite "${FRASE_TEMPORARIAS}" para confirmar.`);
    const n = await carregarNumero(d.numeroId);
    if (n.temporariasSegundos === d.segundos) return undefined;
    await noMotor(() => cliente(deps).definirTemporarias(n.ref, d.segundos));
    await prisma.$transaction(async (tx) => {
      await tx.numeroWhatsApp.update({ where: { id: n.id }, data: { temporariasSegundos: d.segundos } });
      await registrarEvento(tx, { tipo: "NumeroTemporariasAlteradas", agregadoTipo: "NumeroWhatsApp", agregadoId: n.id, autorId: autor.id, payload: { de: n.temporariasSegundos, para: d.segundos } });
    });
    revalidatePath("/configuracao/whatsapp", "layout");
    return undefined;
  });
}

export interface PerfilNumeroDados {
  id: string;
  rotulo: string;
  telefoneE164: string;
  conectado: boolean;
  perfilNome: string | null;
  perfilRecado: string | null;
  privacidade: PrivacidadeNumero | null;
  temporariasSegundos: number;
}

/** Dados da tela (só ADMINISTRADOR). Números MOTOR ativos. */
export async function listarPerfisNumero(): Promise<PerfilNumeroDados[]> {
  await exigirSessaoComPapel(Papel.ADMINISTRADOR);
  const ns = await prisma.numeroWhatsApp.findMany({ where: { driver: "MOTOR", ativo: true }, orderBy: { criadoEm: "asc" } });
  return ns.map((n) => ({
    id: n.id, rotulo: n.rotulo, telefoneE164: n.telefoneE164, conectado: n.sessao === "CONECTADO",
    perfilNome: n.perfilNome, perfilRecado: n.perfilRecado,
    privacidade: (n.privacidade ?? null) as PrivacidadeNumero | null, temporariasSegundos: n.temporariasSegundos,
  }));
}
