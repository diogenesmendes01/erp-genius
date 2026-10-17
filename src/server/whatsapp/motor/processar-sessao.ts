import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { registrarEvento } from "@/server/_shared/evento";
import { acharNumero } from "../inbound";
import { aplicarEstadoSessao } from "../sessao";
import type { EnvelopeMotor } from "./eventos";
import { PROCESSADORES, type ResultadoProcessamento } from "./receber";

const DadosEstadoSchema = z.object({
  estado: z.enum(["AGUARDANDO_QR", "CONECTADO", "CAIU", "DESCONECTADO"]),
  estadoMotor: z.string().nullish(),
  motivo: z.string().nullish(),
  telefoneE164: z.string().nullish(),
});

const DadosQrSchema = z.object({
  qr: z.string().nullish(),
  codigoPareamento: z.string().nullish(),
});

const soDigitos = (t: string) => t.replace(/\D/g, "");

export async function processarSessaoEstado(env: EnvelopeMotor): Promise<ResultadoProcessamento> {
  const parsed = DadosEstadoSchema.safeParse(env.dados);
  if (!parsed.success) return { ignorado: "dados_invalidos" };
  const d = parsed.data;
  const numero = await acharNumero({ numeroProviderRef: env.numeroId, driver: "MOTOR" });
  if (!numero) return { ignorado: "numero_desconhecido" };

  await aplicarEstadoSessao(numero.id, d.estado, "webhook");

  // Telefone divergente: só registra; nunca troca o cadastro.
  if (d.telefoneE164) {
    const cadastro = await prisma.numeroWhatsApp.findUnique({
      where: { id: numero.id },
      select: { telefoneE164: true },
    });
    if (cadastro && soDigitos(cadastro.telefoneE164) !== soDigitos(d.telefoneE164)) {
      await prisma.$transaction((tx) =>
        registrarEvento(tx, {
          tipo: "NumeroWhatsAppTelefoneDivergente",
          agregadoTipo: "NumeroWhatsApp",
          agregadoId: numero.id,
          autorId: null,
          payload: { cadastrado: cadastro.telefoneE164, informadoPeloMotor: d.telefoneE164 },
        }),
      );
    }
  }
  return "ok";
}

export async function processarSessaoQr(env: EnvelopeMotor): Promise<ResultadoProcessamento> {
  const parsed = DadosQrSchema.safeParse(env.dados);
  if (!parsed.success) return { ignorado: "dados_invalidos" };
  const numero = await acharNumero({ numeroProviderRef: env.numeroId, driver: "MOTOR" });
  if (!numero) return { ignorado: "numero_desconhecido" };
  // O QR não é gravado no ERP; só marca que a sessão espera leitura.
  const atual = await prisma.numeroWhatsApp.findUnique({ where: { id: numero.id }, select: { sessao: true } });
  if (atual?.sessao === "CONECTADO") return { ignorado: "ja_conectado" };
  await aplicarEstadoSessao(numero.id, "AGUARDANDO_QR", "webhook");
  return "ok";
}

PROCESSADORES["sessao.estado"] = processarSessaoEstado;
PROCESSADORES["sessao.qr"] = processarSessaoQr;
