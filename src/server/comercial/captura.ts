import type { Prisma } from "@prisma/client";
import { gerarCodigo } from "@/lib/codigo";
import { registrarEvento } from "@/server/_shared/evento";

// CAPTURA AUTOMÁTICA DE LEAD (doc 27 C1 · doc 29 §fluxo F5, regra 6).
// O 1º inbound de um número de VENDAS sem vínculo vira um Lead — MAS pelo MESMO caminho
// que o formulário usa (gerarCodigo "lead" + LeadCriado/LeadAtribuido), nunca um
// `tx.lead.create` solto no webhook (regra 6: pular o Contador/normalização/auditoria).
// Sem sessão: autorId = null (sistema). Dono = dono do NumeroWhatsApp de vendas.
//
// DEDUPE (gap 17): telefone que JÁ é aluno/responsável/lead não vira lead novo — a régua
// de "lead novo" metralhando um aluno matriculado é o cenário concreto que isto evita.

export interface ReferralInbound {
  /** Bloco referral do click-to-WhatsApp (Meta). Baileys normalmente não traz. */
  campanha?: string | null;
  conjunto?: string | null;
  anuncio?: string | null;
  palavra?: string | null;
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
      origemCampanha: dados.referral?.campanha ?? null,
      origemConjunto: dados.referral?.conjunto ?? null,
      origemAnuncio: dados.referral?.anuncio ?? null,
      origemPalavra: dados.referral?.palavra ?? null,
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
): Promise<{ enfileirouSaudacao: boolean; leadCriadoId: string | null }> {
  const nada = { enfileirouSaudacao: false, leadCriadoId: null };
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
  let enfileirouSaudacao = false;
  if (config.saudacaoAtiva) {
    await tx.intencaoMensagem.create({
      data: {
        numeroId: ctx.numero.id,
        contatoId: ctx.contato.id,
        origem: "CRON", // automação sem autor humano; a classe reativa a isenta dos guard-rails de horário
        reativa: true,
        corpoRenderizado: config.saudacaoTexto,
        autorId: null,
      },
    });
    enfileirouSaudacao = true;
  }

  return { enfileirouSaudacao, leadCriadoId };
}
