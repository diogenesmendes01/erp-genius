import type { Prisma } from "@prisma/client";
import { gerarCodigo } from "@/lib/codigo";
import { registrarEvento } from "@/server/_shared/evento";
import { CHAVE_PRE_EXPERIMENTAL } from "./regua-fabrica";

// CAPTURA AUTOMÁTICA DE LEAD (doc 27 C1 · doc 29 §fluxo F5, regra 6).
// O 1º inbound de um número de VENDAS sem vínculo vira um Lead — MAS pelo MESMO caminho
// que o formulário usa (gerarCodigo "lead" + LeadCriado/LeadAtribuido), nunca um
// `tx.lead.create` solto no webhook (regra 6: pular o Contador/normalização/auditoria).
// Sem sessão: autorId = null (sistema). Dono = dono do NumeroWhatsApp de vendas.
//
// DEDUPE (gap 17): telefone que JÁ é aluno/responsável/lead não vira lead novo — a régua
// de "lead novo" metralhando um aluno matriculado é o cenário concreto que isto evita.

export interface ReferralInbound {
  /** Bloco referral CRU do click-to-WhatsApp (Meta). Baileys normalmente não traz.
   *  Campos com a semântica REAL da Meta — NÃO são campanha/conjunto/anúncio/palavra. */
  sourceType?: string | null; // "ad" | "post"
  sourceId?: string | null; // id do anúncio/post
  headline?: string | null; // título do anúncio/post
  sourceUrl?: string | null;
  ctwaClid?: string | null; // id do clique (click-to-WhatsApp)
}

export interface PessoaPorTelefone {
  alunoId: string | null;
  responsavelId: string | null;
  leadId: string | null;
}

/**
 * Primeira pessoa do ERP que atende por este telefone (E.164). Prioridade: aluno →
 * responsável → lead. Vazio = telefone desconhecido (candidato a lead novo).
 * `telefoneE164` já vem normalizado (a mesma regra do sistema — doc 29 regra 5).
 */
export async function resolverPessoaPorTelefone(
  tx: Prisma.TransactionClient,
  telefoneE164: string,
): Promise<PessoaPorTelefone> {
  const [aluno, responsavel, lead] = await Promise.all([
    tx.aluno.findFirst({ where: { telefoneE164 }, select: { id: true } }),
    tx.responsavel.findFirst({ where: { telefoneE164 }, select: { id: true } }),
    tx.lead.findFirst({ where: { telefoneE164 }, orderBy: { criadoEm: "desc" }, select: { id: true } }),
  ]);
  return { alunoId: aluno?.id ?? null, responsavelId: responsavel?.id ?? null, leadId: lead?.id ?? null };
}

export interface LeadDeInbound {
  telefoneE164: string;
  nomeExibicao?: string | null;
  /** Dono do número de vendas → dono do lead (doc 26 §Camada 3). */
  donoId: string | null;
  paisId?: string | null;
  referral?: ReferralInbound | null;
}

/**
 * Cria um Lead a partir de um inbound (sem sessão). MESMO miolo de `criarLead`:
 * `gerarCodigo("lead")` + `LeadCriado` + `LeadAtribuido` (quando há dono) + origem via
 * referral. Retorna o id. NÃO faz dedupe nem vincula contato — quem chama (inbound.ts)
 * já resolveu a identidade e cuida do ContatoWhatsApp.
 */
export async function criarLeadDeInboundWhatsApp(
  tx: Prisma.TransactionClient,
  dados: LeadDeInbound,
): Promise<string> {
  const codigo = await gerarCodigo("lead", tx);
  const lead = await tx.lead.create({
    data: {
      codigo,
      nome: dados.nomeExibicao?.trim() || "Contato WhatsApp",
      telefoneE164: dados.telefoneE164,
      paisId: dados.paisId ?? null,
      vendedorDonoId: dados.donoId,
      // Referral CRU (review PR #53): guarda os campos da Meta com a semântica deles;
      // NÃO preenche origemCampanha/Conjunto/Anúncio/Palavra (a hierarquia de anúncio exige
      // a Marketing API — fora da C1; corromper esses campos quebraria relatórios de origem).
      waReferralSourceType: dados.referral?.sourceType ?? null,
      waReferralSourceId: dados.referral?.sourceId ?? null,
      waReferralHeadline: dados.referral?.headline ?? null,
      waReferralSourceUrl: dados.referral?.sourceUrl ?? null,
      waReferralCtwaClid: dados.referral?.ctwaClid ?? null,
    },
  });
  await registrarEvento(tx, {
    tipo: "LeadCriado",
    agregadoTipo: "Lead",
    agregadoId: lead.id,
    autorId: null, // sistema (auto-captura via WhatsApp)
    payload: { codigo, nome: lead.nome, origem: "whatsapp_inbound", b2b: false },
  });
  if (dados.donoId) {
    await registrarEvento(tx, {
      tipo: "LeadAtribuido",
      agregadoTipo: "Lead",
      agregadoId: lead.id,
      autorId: null,
      payload: { de: null, para: dados.donoId, via: "whatsapp_inbound" },
    });
  }
  return lead.id;
}

// ---------------------------------------------------------------------------
// C2 — resposta à confirmação da experimental (doc 27 §nota bimotor)
// ---------------------------------------------------------------------------

// Botões interativos são confiáveis no driver OFICIAL e instáveis no Baileys — por isso o
// fallback textual ("responda SIM"). O match é EXATO e conservador, como o do opt-out:
// uma frase que contenha "sim" não confirma (falso positivo marcaria presença errada).
//
// O conjunto de CONFIRMAÇÃO é exatamente o PUBLICADO no template ("Responda SIM para
// confirmar ou REAGENDAR...") — review PR #56 P2. `ok`/`si`/`confirmar`/`confirmado` saíram:
// são respostas genéricas de conversa ("ok" fecha qualquer assunto) e marcavam presença por
// engano. Confirmar muda ESTADO do funil; pedir reagendamento só emite um sinal para o
// vendedor, então esse lado pode aceitar os sinônimos naturais sem risco.
const KEYWORDS_CONFIRMA = new Set(["sim", "confirmo"]);
/** Folga entre o relógio do banco (evento) e o do WhatsApp (mensagem) na correlação. */
const TOLERANCIA_RELOGIO_MS = 5 * 60_000;
const KEYWORDS_REAGENDA = new Set(["reagendar", "remarcar", "reagendo", "outro horario", "outro horário"]);

export type RespostaExperimental = "confirmada" | "reagendar" | null;

export function classificarRespostaExperimental(corpo: string | null): RespostaExperimental {
  if (!corpo) return null;
  const t = corpo.trim().toLowerCase();
  if (KEYWORDS_CONFIRMA.has(t)) return "confirmada";
  if (KEYWORDS_REAGENDA.has(t)) return "reagendar";
  return null;
}

/**
 * Captura a resposta do lead à confirmação da experimental. Só vale enquanto há uma
 * experimental AGENDADA (mesma guarda do check-in). Confirmar grava
 * `experimentalConfirmadaEm` + evento; pedir reagendamento só SINALIZA (evento) — quem
 * remarca é o vendedor, pela ação existente (a máquina de funil é uma só, doc 29 regra 7).
 *
 * CORRELAÇÃO com o pedido (review PR #56 P2): uma confirmação é a RESPOSTA a uma pergunta.
 * Sem um lembrete pré-experimental efetivamente enviado para ESTA ocorrência, um "sim" solto
 * numa conversa qualquer não confirma presença nenhuma. A prova do pedido é o evento
 * `ReguaComercialEnviada { chave: PRE_EXPERIMENTAL, ocorrencia }` — o mesmo que o motor usa
 * para contar o degrau cumprido (em SHADOW nada é enviado, logo não há o que confirmar).
 */
export async function capturarRespostaExperimental(
  tx: Prisma.TransactionClient,
  ctx: { leadId: string | null; corpo: string | null; quando: Date },
): Promise<RespostaExperimental> {
  if (!ctx.leadId) return null;
  const resposta = classificarRespostaExperimental(ctx.corpo);
  if (!resposta) return null;

  const lead = await tx.lead.findUnique({
    where: { id: ctx.leadId },
    select: { id: true, etapa: true, dataExperimental: true, experimentalConfirmadaEm: true },
  });
  if (!lead || lead.etapa !== "EXPERIMENTAL_AGENDADA" || !lead.dataExperimental) return null;

  const pedido = await tx.evento.count({
    where: {
      agregadoTipo: "Lead",
      agregadoId: lead.id,
      tipo: "ReguaComercialEnviada",
      // A resposta vem DEPOIS da pergunta — com folga: `criadoEm` é relógio do Postgres e
      // `quando` é o timestamp da mensagem no WhatsApp (granularidade de segundo). Sem a
      // tolerância, quem responde no mesmo instante em que o lembrete é gravado teria a
      // confirmação descartada em silêncio.
      criadoEm: { lte: new Date(ctx.quando.getTime() + TOLERANCIA_RELOGIO_MS) },
      AND: [
        { payload: { path: ["chave"], equals: CHAVE_PRE_EXPERIMENTAL } },
        { payload: { path: ["ocorrencia"], equals: lead.dataExperimental.toISOString() } },
      ],
    },
  });
  if (pedido === 0) return null; // ninguém perguntou nada sobre ESTA experimental

  if (resposta === "confirmada") {
    if (lead.experimentalConfirmadaEm) return null; // já confirmada — não duplica evento
    await tx.lead.update({ where: { id: lead.id }, data: { experimentalConfirmadaEm: ctx.quando } });
    await registrarEvento(tx, {
      tipo: "ExperimentalConfirmada",
      agregadoTipo: "Lead",
      agregadoId: lead.id,
      autorId: null, // o próprio lead respondeu
      payload: { via: "whatsapp_keyword" },
    });
    return "confirmada";
  }

  // B8 (doc 32): o pedido de reagendamento PAUSA a cadência pré-experimental — estado
  // persistido que o cron e o despachante honram até a ação humana (remarcar limpa o campo
  // em `agendarExperimental` e abre uma ocorrência nova). Sem isso, o inbound cancelava as
  // intenções existentes mas o tick seguinte enfileirava o próximo degrau por cima do pedido.
  await tx.lead.update({ where: { id: lead.id }, data: { aguardandoReagendamentoEm: ctx.quando } });
  await registrarEvento(tx, {
    tipo: "ExperimentalReagendamentoSolicitado",
    agregadoTipo: "Lead",
    agregadoId: lead.id,
    autorId: null,
    payload: { via: "whatsapp_keyword" },
  });
  return "reagendar";
}

// ---------------------------------------------------------------------------
// Orquestração no inbound (chamada por whatsapp/inbound.ts, dentro da transação)
// ---------------------------------------------------------------------------

export interface CapturaContexto {
  numero: { id: string; finalidade: string; donoId: string | null; paisId?: string | null };
  contato: {
    id: string;
    telefoneE164: string;
    nomeExibicao: string | null;
    alunoId: string | null;
    responsavelId: string | null;
    leadId: string | null;
    optOut: boolean;
  };
  /** Só o 1º inbound de uma conversa dispara captura/saudação (idempotente por conversa). */
  primeiroInbound: boolean;
  quando: Date;
  referral?: ReferralInbound | null;
}

/**
 * C1 (doc 27): no 1º inbound de um número de VENDAS, auto-captura o lead e programa a
 * saudação. Idempotente (só `primeiroInbound`). Auto-lead e saudação são toggles
 * INDEPENDENTES na ConfigComercial — ambos nascem desligados.
 * Devolve se uma saudação foi enfileirada (o chamador dispara o despacho reativo).
 */
export async function capturarComercial(
  tx: Prisma.TransactionClient,
  ctx: CapturaContexto,
): Promise<{ saudacaoIntencaoId: string | null; leadCriadoId: string | null }> {
  const nada = { saudacaoIntencaoId: null, leadCriadoId: null };
  // Só número de vendas, só o 1º inbound, nunca depois de um opt-out imediato.
  if (ctx.numero.finalidade !== "VENDAS" || !ctx.primeiroInbound || ctx.contato.optOut) return nada;

  const config = await tx.configComercial.findUnique({ where: { id: "comercial" } });
  if (!config) return nada; // nunca configurado → tudo desligado

  let leadCriadoId: string | null = null;
  const jaVinculado = ctx.contato.alunoId || ctx.contato.responsavelId || ctx.contato.leadId;

  if (config.autoLeadAtivo && !jaVinculado) {
    // DEDUPE (gap 17): telefone que já é aluno/responsável/lead só VINCULA o contato.
    const pessoa = await resolverPessoaPorTelefone(tx, ctx.contato.telefoneE164);
    if (pessoa.alunoId || pessoa.responsavelId || pessoa.leadId) {
      await tx.contatoWhatsApp.update({
        where: { id: ctx.contato.id },
        data: {
          alunoId: pessoa.alunoId ?? undefined,
          responsavelId: pessoa.responsavelId ?? undefined,
          leadId: pessoa.leadId ?? undefined,
        },
      });
    } else {
      leadCriadoId = await criarLeadDeInboundWhatsApp(tx, {
        telefoneE164: ctx.contato.telefoneE164,
        nomeExibicao: ctx.contato.nomeExibicao,
        donoId: ctx.numero.donoId,
        paisId: ctx.numero.paisId ?? null,
        referral: ctx.referral ?? null,
      });
      await tx.contatoWhatsApp.update({ where: { id: ctx.contato.id }, data: { leadId: leadCriadoId } });
    }
  }

  // SAUDAÇÃO (reativa, isenta de janela — gap C20). Só texto fixo; a IA da C3 não fala.
  // Enfileira em SHADOW e ATIVA (o despachante simula a de shadow); DESLIGADA não gera nada.
  let saudacaoIntencaoId: string | null = null;
  if (config.saudacaoEstado !== "DESLIGADA") {
    const intencao = await tx.intencaoMensagem.create({
      data: {
        numeroId: ctx.numero.id,
        contatoId: ctx.contato.id,
        origem: "CRON", // automação sem autor humano; a classe reativa a isenta dos guard-rails de horário
        reativa: true,
        corpoRenderizado: config.saudacaoTexto,
        autorId: null,
      },
      select: { id: true },
    });
    saudacaoIntencaoId = intencao.id;
  }

  return { saudacaoIntencaoId, leadCriadoId };
}
