import type { Prisma, StatusTemplate } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { registrarEvento } from "@/server/_shared/evento";

// TEMPLATES × META (doc 26 §Camada 2 — entidade única, ciclo duplo):
// - Marco 1 (mapeador): sincroniza os templates da WABA → statusMeta/metaTemplateId locais
//   (pré-requisito do go-live da cobrança em número oficial);
// - Marco 2 (editor): submissão via API com as variáveis amigáveis {nome}/{valor}/...
//   convertidas para as POSICIONAIS {{1}}..{{n}}; o status volta pelo webhook
//   (message_template_status_update) — rascunho → em revisão → aprovado/rejeitado.
// Env: META_WA_WABA_ID (id da WhatsApp Business Account) + META_WA_TOKEN.

const GRAPH_BASE = process.env.META_WA_GRAPH_URL ?? "https://graph.facebook.com/v21.0";

export class ErroMeta extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ErroMeta";
  }
}

function credenciais(): { token: string; wabaId: string } {
  const token = process.env.META_WA_TOKEN;
  const wabaId = process.env.META_WA_WABA_ID;
  if (!token) throw new ErroMeta("META_WA_TOKEN não configurado.");
  if (!wabaId) throw new ErroMeta("META_WA_WABA_ID não configurado (id da WABA).");
  return { token, wabaId };
}

// ---------------------------------------------------------------------------
// Conversão amigável → posicional (função PURA — testável)
// ---------------------------------------------------------------------------

/** Exemplos exigidos pela Meta na submissão, por variável amigável. */
const EXEMPLO_POR_VARIAVEL: Record<string, string> = {
  nome: "María",
  valor: "₡85.000",
  vencimento: "15/08/2026",
  link: "https://exemplo.com/pagar",
};

export interface CorpoMeta {
  /** Corpo com {{1}}..{{n}} no lugar das variáveis amigáveis. */
  texto: string;
  /** Nomes amigáveis na ordem posicional (repetição ganha posição nova — regra da Meta). */
  variaveis: string[];
  /** Valores de exemplo na mesma ordem (body_text da submissão). */
  exemplos: string[];
}

export function corpoParaMeta(corpo: string): CorpoMeta {
  const variaveis: string[] = [];
  const texto = corpo.replace(/\{(nome|valor|vencimento|link)\}/g, (_, chave: string) => {
    variaveis.push(chave);
    return `{{${variaveis.length}}}`;
  });
  return { texto, variaveis, exemplos: variaveis.map((v) => EXEMPLO_POR_VARIAVEL[v] ?? v) };
}

// ---------------------------------------------------------------------------
// Status Meta → enum local + evento de ciclo (fonte única p/ sync e webhook)
// ---------------------------------------------------------------------------

export function statusMetaParaLocal(status: string | null | undefined): StatusTemplate | null {
  switch ((status ?? "").toUpperCase()) {
    case "APPROVED":
      return "APROVADO";
    case "REJECTED":
    case "PAUSED":
    case "DISABLED":
      return "REJEITADO";
    case "PENDING":
    case "IN_APPEAL":
    case "PENDING_DELETION":
      return "EM_REVISAO";
    default:
      return null;
  }
}

/**
 * Aplica um status vindo da Meta ao template local, gravando o evento de ciclo SÓ na
 * transição (TemplateAprovado/TemplateRejeitado — doc 30 §eventos). Reusada pelo
 * mapeador (sync) e pelo webhook.
 */
export async function aplicarStatusMeta(
  tx: Prisma.TransactionClient,
  template: { id: string; statusMeta: StatusTemplate },
  novo: StatusTemplate,
  contexto: { via: "sync" | "webhook"; metaTemplateId?: string | null; motivo?: string | null },
): Promise<boolean> {
  if (template.statusMeta === novo) {
    if (contexto.metaTemplateId) {
      await tx.templateWhatsApp.update({
        where: { id: template.id },
        data: { metaTemplateId: contexto.metaTemplateId },
      });
    }
    return false;
  }
  await tx.templateWhatsApp.update({
    where: { id: template.id },
    data: { statusMeta: novo, ...(contexto.metaTemplateId ? { metaTemplateId: contexto.metaTemplateId } : {}) },
  });
  const tipo =
    novo === "APROVADO" ? "TemplateAprovado" : novo === "REJEITADO" ? "TemplateRejeitado" : null;
  if (tipo) {
    await registrarEvento(tx, {
      tipo,
      agregadoTipo: "TemplateWhatsApp",
      agregadoId: template.id,
      autorId: null,
      payload: { via: contexto.via, de: template.statusMeta, motivo: contexto.motivo ?? null },
    });
  }
  return true;
}

// ---------------------------------------------------------------------------
// Marco 1 — mapeador (sync WABA → local)
// ---------------------------------------------------------------------------

interface TemplateWaba {
  id?: string;
  name?: string;
  status?: string;
  category?: string;
  language?: string;
  components?: { type?: string; text?: string }[];
}

export interface ResultadoSync {
  atualizados: number;
  importados: number;
  total: number;
}

export async function sincronizarTemplatesWaba(): Promise<ResultadoSync> {
  const { token, wabaId } = credenciais();
  let resposta: Response;
  try {
    resposta = await fetch(
      `${GRAPH_BASE}/${wabaId}/message_templates?fields=id,name,status,category,language,components&limit=100`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
  } catch (e) {
    throw new ErroMeta(e instanceof Error ? e.message : "Falha de rede na Graph API.");
  }
  const json = (await resposta.json().catch(() => ({}))) as {
    data?: TemplateWaba[];
    error?: { message?: string };
  };
  if (!resposta.ok) throw new ErroMeta(json.error?.message ?? `Graph API HTTP ${resposta.status}`);

  const r: ResultadoSync = { atualizados: 0, importados: 0, total: json.data?.length ?? 0 };

  for (const t of json.data ?? []) {
    if (!t.name) continue;
    const statusLocal = statusMetaParaLocal(t.status);
    if (!statusLocal) continue;

    const existente = await prisma.templateWhatsApp.findUnique({ where: { nome: t.name } });
    if (existente) {
      const mudou = await prisma.$transaction((tx) =>
        aplicarStatusMeta(tx, existente, statusLocal, { via: "sync", metaTemplateId: t.id ?? null }),
      );
      if (mudou) r.atualizados += 1;
      continue;
    }

    // Import de template criado direto no gerenciador da Meta: o corpo entra como está
    // (posicional {{n}}); para a régua renderizar as variáveis, o admin edita para as
    // amigáveis {nome}/{valor}/... — a tela avisa (mapeador é status-first, doc 26).
    const corpo = t.components?.find((c) => c.type?.toUpperCase() === "BODY")?.text;
    if (!corpo) continue;
    await prisma.templateWhatsApp.create({
      data: {
        nome: t.name,
        corpo,
        idioma: t.language ?? "es",
        categoria: (t.category ?? "utility").toLowerCase(),
        statusMeta: statusLocal,
        metaTemplateId: t.id ?? null,
      },
    });
    r.importados += 1;
  }
  return r;
}

// ---------------------------------------------------------------------------
// Marco 2 — submissão via API
// ---------------------------------------------------------------------------

export interface ResultadoSubmissao {
  metaTemplateId: string;
}

/**
 * Cria OU edita o template na WABA (review PR #51 P2-4): nome+idioma são a IDENTIDADE na
 * Meta — re-submeter um template que já tem `metaTemplateId` via endpoint de criação
 * falharia como duplicado. Edição usa POST /<template-id> (só categoria/components; a
 * própria edição devolve o template à revisão da Meta).
 */
export async function submeterTemplateNaMeta(template: {
  nome: string;
  corpo: string;
  idioma: string;
  categoria: string;
  metaTemplateId?: string | null;
}): Promise<ResultadoSubmissao> {
  const { token, wabaId } = credenciais();
  const { texto, exemplos } = corpoParaMeta(template.corpo);

  const components = [
    {
      type: "BODY",
      text: texto,
      ...(exemplos.length ? { example: { body_text: [exemplos] } } : {}),
    },
  ];
  const edicao = !!template.metaTemplateId;
  const url = edicao
    ? `${GRAPH_BASE}/${template.metaTemplateId}`
    : `${GRAPH_BASE}/${wabaId}/message_templates`;
  const body = edicao
    ? { category: template.categoria.toUpperCase(), components }
    : {
        name: template.nome,
        language: template.idioma,
        category: template.categoria.toUpperCase(),
        components,
      };

  let resposta: Response;
  try {
    resposta = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new ErroMeta(e instanceof Error ? e.message : "Falha de rede na Graph API.");
  }
  const json = (await resposta.json().catch(() => ({}))) as {
    id?: string;
    success?: boolean;
    error?: { message?: string; error_user_msg?: string };
  };
  if (!resposta.ok) {
    throw new ErroMeta(json.error?.error_user_msg ?? json.error?.message ?? `Graph API HTTP ${resposta.status}`);
  }
  if (edicao) {
    if (json.success !== true) throw new ErroMeta("A Meta não confirmou a edição do template.");
    return { metaTemplateId: template.metaTemplateId! };
  }
  if (!json.id) throw new ErroMeta("Graph API não devolveu o id do template.");
  return { metaTemplateId: json.id };
}

// ---------------------------------------------------------------------------
// Webhook — message_template_status_update (chamado pela rota do webhook Meta)
// ---------------------------------------------------------------------------

export interface StatusTemplateWebhook {
  event?: string;
  message_template_id?: number | string;
  message_template_name?: string;
  message_template_language?: string;
  reason?: string | null;
}

export async function processarStatusTemplateWebhook(v: StatusTemplateWebhook): Promise<void> {
  if (!v.message_template_name) return;
  const statusLocal = statusMetaParaLocal(v.event);
  if (!statusLocal) return;
  const template = await prisma.templateWhatsApp.findUnique({
    where: { nome: v.message_template_name },
  });
  if (!template) return;
  await prisma.$transaction((tx) =>
    aplicarStatusMeta(tx, template, statusLocal, {
      via: "webhook",
      metaTemplateId: v.message_template_id != null ? String(v.message_template_id) : null,
      motivo: v.reason ?? null,
    }),
  );
}
