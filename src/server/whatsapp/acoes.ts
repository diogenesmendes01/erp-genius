"use server";

import { revalidatePath } from "next/cache";
import { Papel, StatusCobranca, type OrigemEnvio, type SessaoNumero } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { contentTypePorExtensao } from "@/lib/uploads";
import {
  ErroRegra,
  executarAcao,
  exigirSessao,
  exigirSessaoComPapel,
  registrarEvento,
  type Resultado,
} from "@/server/_shared";
import { montarReguaPorCobranca } from "@/server/cobrancas/consultas";
import { REGUA } from "@/server/cobrancas/regua";
import { POLITICA_COBRANCA_NOME, TEXTOS_FABRICA } from "@/server/cobrancas/fabrica";
import { carregarPoliticaRegua, type PoliticaCarregada } from "@/server/cobrancas/politica";
import { escopoLeads } from "@/server/comercial/consultas";
import type { ModeloWhatsapp } from "@/server/financeiro/schema";
import { buscarPessoasVinculo, conversaVisivel, type PessoasVinculo } from "./consultas";
import { despacharFila } from "./despachante";
import { escopoConversas } from "./escopo";
import { enfileirarIntencaoCobranca } from "./fila";
import { garantirContato, resolverDestinoCobranca, INCLUDE_DESTINO } from "./identidade";
import {
  ErroMeta,
  sincronizarTemplatesWaba,
  submeterTemplateNaMeta,
  type ResultadoSync,
} from "./meta-templates";
import { tipoPorMime } from "./midia";
import { renderizarTemplate } from "./render";
import {
  LoteCobrancaSchema,
  EnviarMidiaInboxSchema,
  EnviarTextoInboxSchema,
  NumeroWhatsAppSchema,
  PoliticaReguaSchema,
  TemplateWhatsAppSchema,
  TratarConversaSchema,
  VincularContatoSchema,
  type EnviarMidiaInboxInput,
  type EnviarTextoInboxInput,
  type LoteCobrancaInput,
  type NumeroWhatsAppInput,
  type PoliticaReguaInput,
  type TemplateWhatsAppInput,
  type TratarConversaInput,
  type VincularContatoInput,
} from "./schema";
import {
  conectarInstanciaEvolution,
  consultarEstadoInstancia,
  type ResultadoConexao,
} from "./sessao";

// Ações do braço API da fila de cobrança (doc 30 E2). Mesmos papéis que já operam a
// cobrança manual (financeiro/acoes.ts). NENHUMA envia direto: gravam INTENÇÃO e chamam o
// despachante — humano/lote passam pelos MESMOS guard-rails do cron (doc 26 §fila única).
// Papéis definitivos por papel×ação: gap 21 do doc 28 (matriz), pendente para a E3/E5.

const PAPEIS_ENVIO: Papel[] = [Papel.FINANCEIRO, Papel.SECRETARIA_ACADEMICA];

interface CanalPronto {
  politica: PoliticaCarregada;
  numeroId: string;
  templates: Map<string, { id: string; nome: string; corpo: string; idioma: string }>;
}

async function prepararCanal(): Promise<CanalPronto> {
  const politica = await carregarPoliticaRegua();
  if (!politica.numeroRemetenteId) {
    throw new ErroRegra("Configure o número remetente da política de cobrança (tela do canal, E3/E4).");
  }
  const numero = await prisma.numeroWhatsApp.findUnique({ where: { id: politica.numeroRemetenteId } });
  if (!numero || !numero.ativo) throw new ErroRegra("O número remetente da cobrança está inativo.");
  const templates = await prisma.templateWhatsApp.findMany({
    select: { id: true, nome: true, corpo: true, idioma: true },
  });
  return { politica, numeroId: numero.id, templates: new Map(templates.map((t) => [t.id, t])) };
}

/** Enfileira o degrau DEVIDO de uma cobrança. Lança ErroRegra com motivo claro quando não dá. */
async function enfileirarDegrauDevido(
  canal: CanalPronto,
  cobrancaId: string,
  origem: OrigemEnvio,
  autorId: string,
): Promise<{ passo: string; resultado: "criada" | "reaberta" | "ja_existente" }> {
  const cobranca = await prisma.cobranca.findUnique({ where: { id: cobrancaId }, include: INCLUDE_DESTINO });
  if (!cobranca) throw new ErroRegra("Cobrança não encontrada.");
  if (cobranca.status !== StatusCobranca.PENDENTE && cobranca.status !== StatusCobranca.ATRASADO) {
    throw new ErroRegra("Cobrança quitada/cancelada não entra na fila de envio.");
  }

  const hoje = new Date();
  const regua = await montarReguaPorCobranca(
    [{ id: cobranca.id, vencimento: cobranca.vencimento, acessoBloqueado: cobranca.matricula.acessoBloqueado }],
    hoje,
    canal.politica.degraus,
  );
  const calc = regua.get(cobranca.id);
  if (!calc || calc.estado !== "acao_devida" || !calc.passo) {
    throw new ErroRegra("Sem ação devida hoje para esta cobrança.");
  }

  const destino = resolverDestinoCobranca(cobranca);
  if (!destino) {
    throw new ErroRegra("Sem destino: cadastre o telefone do responsável financeiro (ou do aluno adulto).");
  }

  const tId = canal.politica.templateIdPorPasso.get(calc.passo) ?? null;
  const template =
    (tId ? canal.templates.get(tId) : undefined) ??
    [...canal.templates.values()].find((t) => t.nome === calc.template) ??
    null;
  const corpoTemplate = template?.corpo ?? TEXTOS_FABRICA[(calc.template ?? "dados") as ModeloWhatsapp];
  const valorDevido = Number(cobranca.saldo ?? cobranca.valorNegociado);
  const { corpo, variaveis } = renderizarTemplate(corpoTemplate, {
    nome: destino.nome,
    valor: valorDevido > 0 ? valorDevido : Number(cobranca.valorNegociado),
    moeda: cobranca.moeda,
    vencimento: cobranca.vencimento,
    idioma: template?.idioma ?? cobranca.matricula.aluno.pais?.idioma ?? "es",
  });

  const passo = calc.passo;
  const resultado = await prisma.$transaction(async (tx) => {
    const contato = await garantirContato(tx, {
      telefoneE164: destino.telefoneE164,
      alunoId: destino.responsavelId ? null : destino.alunoId,
      responsavelId: destino.responsavelId,
      nomeExibicao: destino.nome,
    });
    return enfileirarIntencaoCobranca(tx, {
      cobrancaId: cobranca.id,
      passo,
      numeroId: canal.numeroId,
      contatoId: contato.id,
      origem,
      corpoRenderizado: corpo,
      variaveis,
      templateId: template?.id ?? null,
      politicaId: canal.politica.id,
      autorId,
    });
  });
  return { passo, resultado };
}

export interface EnvioApiResultado {
  passo: string;
  /** Estado final da intenção após o despacho imediato. */
  status: string;
  motivo: string | null;
}

/** Botão da fila (doc 30 E2): enfileira o degrau devido e despacha na hora (origem HUMANO). */
export async function enfileirarCobrancaWhatsApp(cobrancaId: string): Promise<Resultado<EnvioApiResultado>> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(...PAPEIS_ENVIO);
    const canal = await prepararCanal();
    const { passo } = await enfileirarDegrauDevido(canal, cobrancaId, "HUMANO", autor.id);

    await despacharFila();

    const intencao = await prisma.intencaoMensagem.findUnique({
      where: { cobrancaId_passo: { cobrancaId, passo } },
      select: { status: true, motivoFalha: true },
    });
    revalidatePath("/financeiro");
    return { passo, status: intencao?.status ?? "PENDENTE", motivo: intencao?.motivoFalha ?? null };
  });
}

export interface LoteResultado {
  enfileiradas: number;
  puladas: { cobrancaId: string; motivo: string }[];
  despachadas: number;
  simuladas: number;
  falhas: number;
}

/** Lote-com-aprovação (doc 24 §V2 → doc 26): humano seleciona e aprova; a fila dispara. */
export async function aprovarLoteCobranca(input: LoteCobrancaInput): Promise<Resultado<LoteResultado>> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(...PAPEIS_ENVIO);
    const { cobrancaIds } = LoteCobrancaSchema.parse(input);
    const canal = await prepararCanal();

    let enfileiradas = 0;
    const puladas: { cobrancaId: string; motivo: string }[] = [];
    for (const id of cobrancaIds) {
      try {
        await enfileirarDegrauDevido(canal, id, "LOTE", autor.id);
        enfileiradas += 1;
      } catch (e) {
        // Item inválido não derruba o lote — volta com o motivo estampado (doc 26).
        puladas.push({ cobrancaId: id, motivo: e instanceof ErroRegra ? e.message : "Erro inesperado." });
      }
    }

    const despacho = await despacharFila();
    revalidatePath("/financeiro");
    return {
      enfileiradas,
      puladas,
      despachadas: despacho.despachadas,
      simuladas: despacho.simuladas,
      falhas: despacho.falhas,
    };
  });
}

// ===========================================================================
// INBOX (doc 26 §Camada 3 · doc 30 E3). Guard: escopo do NÚMERO (escopo.ts, D22) —
// quem vê a conversa opera a conversa; alçadas de cobrança seguem as ações existentes.
// Clique na inbox também NÃO envia direto: grava intenção (origem HUMANO, isenta de
// janela/teto — C20) e chama o mesmo despachante da régua (doc 26 §fila única).
// ===========================================================================

export interface EnvioInboxResultado {
  status: string;
  motivo: string | null;
}

async function despacharIntencaoInbox(intencaoId: string): Promise<EnvioInboxResultado> {
  await despacharFila();
  const final = await prisma.intencaoMensagem.findUnique({
    where: { id: intencaoId },
    select: { status: true, motivoFalha: true },
  });
  revalidatePath("/inbox");
  return { status: final?.status ?? "PENDENTE", motivo: final?.motivoFalha ?? null };
}

/** Texto livre da inbox (thread). */
export async function enviarTextoInbox(input: EnviarTextoInboxInput): Promise<Resultado<EnvioInboxResultado>> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    const { conversaId, texto } = EnviarTextoInboxSchema.parse(input);
    const conversa = await conversaVisivel(autor, conversaId);
    if (!conversa) throw new ErroRegra("Conversa não encontrada ou fora do seu escopo.");
    if (!conversa.numero.ativo) throw new ErroRegra("Este número está inativo.");
    if (conversa.contato.optOutEm) {
      throw new ErroRegra("O contato pediu para não receber mensagens (opt-out). Reative-o antes de enviar.");
    }

    const intencao = await prisma.intencaoMensagem.create({
      data: {
        numeroId: conversa.numeroId,
        contatoId: conversa.contatoId,
        origem: "HUMANO",
        tipo: "TEXTO",
        corpoRenderizado: texto,
        autorId: autor.id,
      },
    });
    return despacharIntencaoInbox(intencao.id);
  });
}

/** Mídia da inbox: o arquivo já subiu pelo POST /api/upload; aqui só vira intenção. */
export async function enviarMidiaInbox(input: EnviarMidiaInboxInput): Promise<Resultado<EnvioInboxResultado>> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    const { conversaId, url, legenda } = EnviarMidiaInboxSchema.parse(input);
    const conversa = await conversaVisivel(autor, conversaId);
    if (!conversa) throw new ErroRegra("Conversa não encontrada ou fora do seu escopo.");
    if (!conversa.numero.ativo) throw new ErroRegra("Este número está inativo.");
    if (conversa.contato.optOutEm) {
      throw new ErroRegra("O contato pediu para não receber mensagens (opt-out). Reative-o antes de enviar.");
    }

    const mime = contentTypePorExtensao(url);
    const tipo = tipoPorMime(mime);
    if (!mime || tipo === "TEXTO" || tipo === "OUTRO") {
      throw new ErroRegra("Tipo de arquivo não suportado para envio.");
    }

    const intencao = await prisma.intencaoMensagem.create({
      data: {
        numeroId: conversa.numeroId,
        contatoId: conversa.contatoId,
        origem: "HUMANO",
        tipo,
        midiaPath: url,
        corpoRenderizado: legenda ?? "",
        autorId: autor.id,
      },
    });
    return despacharIntencaoInbox(intencao.id);
  });
}

/** Zera o contador de não-lidas ao abrir a thread (tabela operacional — sem evento). */
export async function marcarConversaLida(conversaId: string): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    const conversa = await conversaVisivel(autor, conversaId);
    if (!conversa) throw new ErroRegra("Conversa não encontrada ou fora do seu escopo.");
    if (conversa.naoLidas > 0) {
      await prisma.conversaWhatsApp.update({ where: { id: conversaId }, data: { naoLidas: 0 } });
    }
    revalidatePath("/inbox");
  });
}

// "Tratar" o inbound (S4): promessa/pagamento pela inbox ou "retomar régua" liberam o
// silêncio pós-inbound. Alçada = quem opera cobrança (doc 12: Financeiro/Secretaria).
const PAPEIS_TRATAR: Papel[] = [Papel.FINANCEIRO, Papel.SECRETARIA_ACADEMICA];

export async function marcarConversaTratada(input: TratarConversaInput): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(...PAPEIS_TRATAR);
    const { conversaId, motivo } = TratarConversaSchema.parse(input);
    const conversa = await conversaVisivel(autor, conversaId);
    if (!conversa) throw new ErroRegra("Conversa não encontrada ou fora do seu escopo.");

    await prisma.$transaction(async (tx) => {
      await tx.conversaWhatsApp.update({
        where: { id: conversaId },
        data: { inboundTratadoEm: new Date() },
      });
      // Evento de negócio só na retomada explícita — promessa/pagamento já têm os seus.
      if (motivo === "retomar_regua") {
        await registrarEvento(tx, {
          tipo: "ReguaRetomada",
          agregadoTipo: "ContatoWhatsApp",
          agregadoId: conversa.contatoId,
          autorId: autor.id,
          payload: { conversaId },
        });
      }
    });
    revalidatePath("/inbox");
  });
}

/** Busca de pessoas para o vínculo (client-side da inbox — respeita escopoLeads). */
export async function buscarVinculosInbox(q: string): Promise<Resultado<PessoasVinculo>> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    return buscarPessoasVinculo(autor, q);
  });
}

/** Vincular contato → aluno/responsável/lead (doc 26 §Camada 3; auditoria D26). */
export async function vincularContatoWhatsApp(input: VincularContatoInput): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    const { contatoId, alvo } = VincularContatoSchema.parse(input);

    // Guard: o contato precisa estar em alguma conversa visível ao usuário.
    const alcance = await prisma.conversaWhatsApp.findFirst({
      where: { contatoId, ...escopoConversas(autor) },
      select: { id: true },
    });
    if (!alcance) throw new ErroRegra("Contato fora do seu escopo.");

    const contato = await prisma.contatoWhatsApp.findUnique({ where: { id: contatoId } });
    if (!contato) throw new ErroRegra("Contato não encontrado.");

    let data: { alunoId?: string; responsavelId?: string; leadId?: string };
    if (alvo.tipo === "aluno") {
      const aluno = await prisma.aluno.findUnique({ where: { id: alvo.id }, select: { id: true } });
      if (!aluno) throw new ErroRegra("Aluno não encontrado.");
      data = { alunoId: aluno.id };
    } else if (alvo.tipo === "responsavel") {
      const resp = await prisma.responsavel.findUnique({ where: { id: alvo.id }, select: { id: true } });
      if (!resp) throw new ErroRegra("Responsável não encontrado.");
      data = { responsavelId: resp.id };
    } else {
      // Vendedor só vincula aos PRÓPRIOS leads (mesmo row-level das telas).
      const lead = await prisma.lead.findFirst({
        where: { id: alvo.id, ...escopoLeads(autor) },
        select: { id: true },
      });
      if (!lead) throw new ErroRegra("Lead não encontrado ou fora do seu escopo.");
      data = { leadId: lead.id };
    }

    await prisma.$transaction(async (tx) => {
      await tx.contatoWhatsApp.update({ where: { id: contatoId }, data });
      await registrarEvento(tx, {
        tipo: "ContatoVinculado",
        agregadoTipo: "ContatoWhatsApp",
        agregadoId: contatoId,
        autorId: autor.id,
        payload: {
          alvo,
          antes: { alunoId: contato.alunoId, responsavelId: contato.responsavelId, leadId: contato.leadId },
        },
      });
    });
    revalidatePath("/inbox");
  });
}

/** Opt-out manual (botão da thread — S10) e a reativação, ambos auditáveis (D26/D27). */
export async function registrarOptOutContato(contatoId: string): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    const alcance = await prisma.conversaWhatsApp.findFirst({
      where: { contatoId, ...escopoConversas(autor) },
      select: { id: true },
    });
    if (!alcance) throw new ErroRegra("Contato fora do seu escopo.");

    await prisma.$transaction(async (tx) => {
      const { count } = await tx.contatoWhatsApp.updateMany({
        where: { id: contatoId, optOutEm: null },
        data: { optOutEm: new Date() },
      });
      if (count === 0) throw new ErroRegra("Contato já está em opt-out.");
      await registrarEvento(tx, {
        tipo: "OptOutRegistrado",
        agregadoTipo: "ContatoWhatsApp",
        agregadoId: contatoId,
        autorId: autor.id,
        payload: { via: "botao" },
      });
    });
    revalidatePath("/inbox");
  });
}

export async function removerOptOutContato(contatoId: string): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    const alcance = await prisma.conversaWhatsApp.findFirst({
      where: { contatoId, ...escopoConversas(autor) },
      select: { id: true },
    });
    if (!alcance) throw new ErroRegra("Contato fora do seu escopo.");

    await prisma.$transaction(async (tx) => {
      const { count } = await tx.contatoWhatsApp.updateMany({
        where: { id: contatoId, optOutEm: { not: null } },
        data: { optOutEm: null },
      });
      if (count === 0) throw new ErroRegra("Contato não está em opt-out.");
      await registrarEvento(tx, {
        tipo: "OptOutRemovido",
        agregadoTipo: "ContatoWhatsApp",
        agregadoId: contatoId,
        autorId: autor.id,
        payload: {},
      });
    });
    revalidatePath("/inbox");
  });
}

// ===========================================================================
// CONFIG DO CANAL (E3/E4) — números, sessão/QR, templates e política.
// Alçada: ADMINISTRADOR (doc 26: "régua configurável pelo admin"; matriz D21 na E3).
// ===========================================================================

export interface NumeroSalvoResultado {
  id: string;
}

export async function salvarNumeroWhatsApp(input: NumeroWhatsAppInput): Promise<Resultado<NumeroSalvoResultado>> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.ADMINISTRADOR);
    const dados = NumeroWhatsAppSchema.parse(input);

    if (dados.donoId) {
      const dono = await prisma.usuario.findFirst({ where: { id: dados.donoId, ativo: true }, select: { id: true } });
      if (!dono) throw new ErroRegra("Dono inválido (usuário inexistente ou inativo).");
    }

    const conflito = await prisma.numeroWhatsApp.findFirst({
      where: { telefoneE164: dados.telefoneE164, ...(dados.id ? { id: { not: dados.id } } : {}) },
      select: { id: true },
    });
    if (conflito) throw new ErroRegra("Já existe um número cadastrado com este telefone.");

    const id = await prisma.$transaction(async (tx) => {
      if (dados.id) {
        const antes = await tx.numeroWhatsApp.findUnique({ where: { id: dados.id } });
        if (!antes) throw new ErroRegra("Número não encontrado.");
        await tx.numeroWhatsApp.update({
          where: { id: dados.id },
          data: {
            telefoneE164: dados.telefoneE164,
            rotulo: dados.rotulo,
            driver: dados.driver,
            finalidade: dados.finalidade,
            providerRef: dados.providerRef,
            donoId: dados.donoId,
            ativo: dados.ativo,
          },
        });
        // Auditoria D26 (inclui troca de driver): antes → depois.
        await registrarEvento(tx, {
          tipo: "NumeroWhatsAppAlterado",
          agregadoTipo: "NumeroWhatsApp",
          agregadoId: dados.id,
          autorId: autor.id,
          payload: {
            antes: {
              telefoneE164: antes.telefoneE164,
              rotulo: antes.rotulo,
              driver: antes.driver,
              finalidade: antes.finalidade,
              providerRef: antes.providerRef,
              donoId: antes.donoId,
              ativo: antes.ativo,
            },
            depois: {
              telefoneE164: dados.telefoneE164,
              rotulo: dados.rotulo,
              driver: dados.driver,
              finalidade: dados.finalidade,
              providerRef: dados.providerRef,
              donoId: dados.donoId,
              ativo: dados.ativo,
            },
          },
        });
        return dados.id;
      }
      const criado = await tx.numeroWhatsApp.create({
        data: {
          telefoneE164: dados.telefoneE164,
          rotulo: dados.rotulo,
          driver: dados.driver,
          finalidade: dados.finalidade,
          providerRef: dados.providerRef,
          donoId: dados.donoId,
          ativo: dados.ativo,
        },
      });
      await registrarEvento(tx, {
        tipo: "NumeroWhatsAppCriado",
        agregadoTipo: "NumeroWhatsApp",
        agregadoId: criado.id,
        autorId: autor.id,
        payload: { telefoneE164: dados.telefoneE164, driver: dados.driver, finalidade: dados.finalidade },
      });
      return criado.id;
    });

    revalidatePath("/configuracao/whatsapp");
    return { id };
  });
}

export interface ConexaoQrResultado {
  qrBase64: string | null;
  estado: SessaoNumero;
  erro: string | null;
}

/** Fluxo "conectar via QR" (doc 26 §Camada 0/E3) — só números BAILEYS. */
export async function conectarNumeroQr(numeroId: string): Promise<Resultado<ConexaoQrResultado>> {
  return executarAcao(async () => {
    await exigirSessaoComPapel(Papel.ADMINISTRADOR);
    const numero = await prisma.numeroWhatsApp.findUnique({ where: { id: numeroId } });
    if (!numero) throw new ErroRegra("Número não encontrado.");
    if (numero.driver !== "BAILEYS") throw new ErroRegra("Só números Baileys conectam via QR.");
    if (!numero.ativo) throw new ErroRegra("Número inativo.");

    let providerRef = numero.providerRef;
    if (!providerRef) {
      providerRef = `genius${numero.telefoneE164.replace(/\D/g, "")}`;
      await prisma.numeroWhatsApp.update({ where: { id: numeroId }, data: { providerRef } });
    }

    const r: ResultadoConexao = await conectarInstanciaEvolution({ id: numero.id, providerRef });
    revalidatePath("/configuracao/whatsapp");
    return r;
  });
}

/** Poll do estado da sessão (tela do número). */
export async function consultarSessaoNumero(numeroId: string): Promise<Resultado<{ sessao: SessaoNumero }>> {
  return executarAcao(async () => {
    await exigirSessaoComPapel(Papel.ADMINISTRADOR);
    const numero = await prisma.numeroWhatsApp.findUnique({ where: { id: numeroId } });
    if (!numero) throw new ErroRegra("Número não encontrado.");
    if (numero.driver !== "BAILEYS" || !numero.providerRef) return { sessao: numero.sessao };
    const sessao = await consultarEstadoInstancia({ id: numero.id, providerRef: numero.providerRef });
    revalidatePath("/configuracao/whatsapp");
    return { sessao };
  });
}

// --- Templates (Camada 2: entidade única, ciclo duplo) ----------------------

export async function salvarTemplateWhatsApp(input: TemplateWhatsAppInput): Promise<Resultado<{ id: string }>> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.ADMINISTRADOR);
    const dados = TemplateWhatsAppSchema.parse(input);

    const id = await prisma.$transaction(async (tx) => {
      if (dados.id) {
        const antes = await tx.templateWhatsApp.findUnique({ where: { id: dados.id } });
        if (!antes) throw new ErroRegra("Template não encontrado.");
        // Nome é a identidade na Meta: só renomeia quem nunca foi submetido.
        if (dados.nome !== antes.nome && antes.metaTemplateId) {
          throw new ErroRegra("Template já submetido à Meta não pode mudar de nome — crie um novo.");
        }
        const mudouConteudo =
          dados.corpo !== antes.corpo || dados.idioma !== antes.idioma || dados.categoria !== antes.categoria;
        // Edição de aprovado volta ao rascunho (doc 26 §Camada 2): precisa re-submeter.
        const statusMeta = mudouConteudo && antes.statusMeta === "APROVADO" ? "RASCUNHO" : antes.statusMeta;
        await tx.templateWhatsApp.update({
          where: { id: dados.id },
          data: { nome: dados.nome, corpo: dados.corpo, idioma: dados.idioma, categoria: dados.categoria, statusMeta },
        });
        await registrarEvento(tx, {
          tipo: "TemplateAlterado",
          agregadoTipo: "TemplateWhatsApp",
          agregadoId: dados.id,
          autorId: autor.id,
          payload: {
            antes: { corpo: antes.corpo, idioma: antes.idioma, categoria: antes.categoria, statusMeta: antes.statusMeta },
            depois: { corpo: dados.corpo, idioma: dados.idioma, categoria: dados.categoria, statusMeta },
          },
        });
        return dados.id;
      }

      const conflito = await tx.templateWhatsApp.findUnique({ where: { nome: dados.nome }, select: { id: true } });
      if (conflito) throw new ErroRegra("Já existe um template com este nome.");
      const criado = await tx.templateWhatsApp.create({
        data: { nome: dados.nome, corpo: dados.corpo, idioma: dados.idioma, categoria: dados.categoria },
      });
      await registrarEvento(tx, {
        tipo: "TemplateCriado",
        agregadoTipo: "TemplateWhatsApp",
        agregadoId: criado.id,
        autorId: autor.id,
        payload: { nome: dados.nome, idioma: dados.idioma, categoria: dados.categoria },
      });
      return criado.id;
    });

    revalidatePath("/configuracao/whatsapp");
    return { id };
  });
}

/** Submete o template à revisão da Meta (Marco 2). Status final volta pelo webhook. */
export async function submeterTemplateMeta(templateId: string): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.ADMINISTRADOR);
    const template = await prisma.templateWhatsApp.findUnique({ where: { id: templateId } });
    if (!template) throw new ErroRegra("Template não encontrado.");
    if (template.statusMeta === "EM_REVISAO") throw new ErroRegra("Template já está em revisão na Meta.");
    if (template.statusMeta === "APROVADO") throw new ErroRegra("Template já aprovado — edite-o para re-submeter.");

    let metaTemplateId: string;
    try {
      ({ metaTemplateId } = await submeterTemplateNaMeta(template));
    } catch (e) {
      if (e instanceof ErroMeta) throw new ErroRegra(`Meta recusou a submissão: ${e.message}`);
      throw e;
    }

    await prisma.$transaction(async (tx) => {
      await tx.templateWhatsApp.update({
        where: { id: templateId },
        data: { statusMeta: "EM_REVISAO", metaTemplateId },
      });
      await registrarEvento(tx, {
        tipo: "TemplateSubmetido",
        agregadoTipo: "TemplateWhatsApp",
        agregadoId: templateId,
        autorId: autor.id,
        payload: { metaTemplateId },
      });
    });
    revalidatePath("/configuracao/whatsapp");
  });
}

/** Mapeador (Marco 1): sincroniza a WABA → status/ids locais + importa aprovados. */
export async function sincronizarTemplatesMeta(): Promise<Resultado<ResultadoSync>> {
  return executarAcao(async () => {
    await exigirSessaoComPapel(Papel.ADMINISTRADOR);
    try {
      const r = await sincronizarTemplatesWaba();
      revalidatePath("/configuracao/whatsapp");
      return r;
    } catch (e) {
      if (e instanceof ErroMeta) throw new ErroRegra(`Sincronização falhou: ${e.message}`);
      throw e;
    }
  });
}

// --- Política da régua (config como DADO — doc 26 §Camada 1) ----------------

const TIPO_ROTULO_POR_PASSO = new Map(REGUA.map((d) => [d.passo, { tipo: d.tipo, rotulo: d.rotulo }]));

export async function salvarPoliticaRegua(input: PoliticaReguaInput): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.ADMINISTRADOR);
    const dados = PoliticaReguaSchema.parse(input);

    // LEI (doc 26/30): D+15 (bloquear) nunca automatiza — força MANUAL mesmo que a UI minta.
    const degraus = dados.degraus.map((d) => {
      const fixo = TIPO_ROTULO_POR_PASSO.get(d.passo);
      if (!fixo) throw new ErroRegra(`Passo desconhecido: ${d.passo}.`);
      return { ...d, tipo: fixo.tipo, rotulo: fixo.rotulo, modo: fixo.tipo === "bloquear" ? ("MANUAL" as const) : d.modo };
    });

    // Prontidão (S15): armar a política (SHADOW/ATIVA) valida o canal por número
    // (doc 26: "degrau só arma se o template estiver pronto para o driver do remetente").
    if (dados.estado !== "DESLIGADA") {
      if (!dados.numeroRemetenteId) throw new ErroRegra("Defina o número remetente antes de armar a política.");
      const remetente = await prisma.numeroWhatsApp.findUnique({ where: { id: dados.numeroRemetenteId } });
      if (!remetente || !remetente.ativo) throw new ErroRegra("Número remetente inexistente ou inativo.");

      const automaticos = degraus.filter((d) => d.ativo && d.modo === "AUTOMATICO");
      // TRAVA S1 (lei): régua automática exige driver oficial.
      if (remetente.driver !== "META_CLOUD" && automaticos.length > 0) {
        throw new ErroRegra(
          "Trava do cron (S1): degraus automáticos exigem número com driver oficial (Meta Cloud). " +
            "Troque o remetente ou deixe os degraus em manual/lote.",
        );
      }
      if (remetente.driver === "META_CLOUD") {
        const armados = degraus.filter((d) => d.ativo && d.modo !== "MANUAL");
        const templates = await prisma.templateWhatsApp.findMany({
          where: { id: { in: armados.map((d) => d.templateId).filter((x): x is string => !!x) } },
          select: { id: true, statusMeta: true },
        });
        const aprovado = new Map(templates.map((t) => [t.id, t.statusMeta === "APROVADO"]));
        const pendentes = armados.filter((d) => !d.templateId || !aprovado.get(d.templateId));
        if (pendentes.length > 0) {
          throw new ErroRegra(
            `Degrau(s) ${pendentes.map((d) => d.passo).join(", ")} sem template APROVADO na Meta — ` +
              "aprove os templates (tela ao lado) antes de armar a política em número oficial.",
          );
        }
      }
    }

    await prisma.$transaction(async (tx) => {
      const existente = await tx.politicaRegua.findFirst({
        where: { escopo: "COBRANCA" },
        include: { degraus: true },
        orderBy: { criadoEm: "asc" },
      });

      const snapshot = (p: typeof dados, degs: typeof degraus) => ({
        estado: p.estado,
        janelaInicio: p.janelaInicio,
        janelaFim: p.janelaFim,
        diasSemana: p.diasSemana,
        tetoPorContatoDia: p.tetoPorContatoDia,
        silencioPosInboundHoras: p.silencioPosInboundHoras,
        killSwitch: p.killSwitch,
        numeroRemetenteId: p.numeroRemetenteId,
        degraus: degs.map((d) => ({
          passo: d.passo,
          offsetDias: d.offsetDias,
          modo: d.modo,
          ativo: d.ativo,
          templateId: d.templateId,
        })),
      });

      const antes = existente
        ? {
            estado: existente.estado,
            janelaInicio: existente.janelaInicio,
            janelaFim: existente.janelaFim,
            diasSemana: existente.diasSemana,
            tetoPorContatoDia: existente.tetoPorContatoDia,
            silencioPosInboundHoras: existente.silencioPosInboundHoras,
            killSwitch: existente.killSwitch,
            numeroRemetenteId: existente.numeroRemetenteId,
            degraus: existente.degraus
              .sort((a, b) => a.offsetDias - b.offsetDias)
              .map((d) => ({ passo: d.passo, offsetDias: d.offsetDias, modo: d.modo, ativo: d.ativo, templateId: d.templateId })),
          }
        : null;

      const politicaId = existente
        ? existente.id
        : (
            await tx.politicaRegua.create({
              data: { nome: POLITICA_COBRANCA_NOME, escopo: "COBRANCA" },
            })
          ).id;

      await tx.politicaRegua.update({
        where: { id: politicaId },
        data: {
          estado: dados.estado,
          janelaInicio: dados.janelaInicio,
          janelaFim: dados.janelaFim,
          diasSemana: dados.diasSemana,
          tetoPorContatoDia: dados.tetoPorContatoDia,
          silencioPosInboundHoras: dados.silencioPosInboundHoras,
          killSwitch: dados.killSwitch,
          numeroRemetenteId: dados.numeroRemetenteId,
        },
      });

      for (const d of degraus) {
        await tx.degrauPolitica.upsert({
          where: { politicaId_passo: { politicaId, passo: d.passo } },
          create: {
            politicaId,
            passo: d.passo,
            offsetDias: d.offsetDias,
            tipo: d.tipo,
            rotulo: d.rotulo,
            modo: d.modo,
            ativo: d.ativo,
            templateId: d.templateId,
          },
          update: { offsetDias: d.offsetDias, modo: d.modo, ativo: d.ativo, templateId: d.templateId },
        });
      }

      // Auditoria D26: mudança de política com antes → depois.
      await registrarEvento(tx, {
        tipo: "PoliticaReguaAlterada",
        agregadoTipo: "PoliticaRegua",
        agregadoId: politicaId,
        autorId: autor.id,
        payload: { antes, depois: snapshot(dados, degraus) },
      });
    });

    revalidatePath("/configuracao/whatsapp");
    revalidatePath("/financeiro"); // timeline do drawer lê a política do banco (E2)
  });
}

/** Freio de emergência: liga/desliga o kill switch sem mexer no resto da política. */
export async function acionarKillSwitchRegua(ligado: boolean): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.ADMINISTRADOR);
    const politica = await prisma.politicaRegua.findFirst({
      where: { escopo: "COBRANCA" },
      orderBy: { criadoEm: "asc" },
    });
    if (!politica) throw new ErroRegra("A política ainda não foi salva — não há automação para frear.");
    if (politica.killSwitch === ligado) return;

    await prisma.$transaction(async (tx) => {
      await tx.politicaRegua.update({ where: { id: politica.id }, data: { killSwitch: ligado } });
      await registrarEvento(tx, {
        tipo: "PoliticaReguaAlterada",
        agregadoTipo: "PoliticaRegua",
        agregadoId: politica.id,
        autorId: autor.id,
        payload: { antes: { killSwitch: politica.killSwitch }, depois: { killSwitch: ligado } },
      });
    });
    revalidatePath("/configuracao/whatsapp");
    revalidatePath("/financeiro");
  });
}
