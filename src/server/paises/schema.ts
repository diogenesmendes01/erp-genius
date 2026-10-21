import { z } from "zod";
import { fusoIanaValido } from "@/server/operacao/fuso";

export const MSG_FUSO_PAIS_VAZIO = "Informe o fuso horário do país, como America/Costa_Rica.";
export const MSG_FUSO_PAIS_INVALIDO = "Fuso horário não reconhecido. Escolha um da lista, como America/Costa_Rica ou America/Sao_Paulo.";

// Schema compartilhado País (form ↔ ação). Ver docs/04 (país = espinha dorsal).
export const TipoDocumentoSchema = z.object({
  id: z.string().min(1).optional(),
  nome: z.string().min(1, "Informe o nome do documento"),
  validador: z.string().min(1, "Informe o validador"),
});

export const PaisSchema = z.object({
  nome: z.string().min(1, "Informe o nome do país"),
  codigoISO: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{2}$/, "Código ISO de 2 letras (ex.: CR, PA)")
    .transform((v) => v.toUpperCase()),
  moedaLocal: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{3}$/, "Moeda em 3 letras (ex.: CRC, USD)")
    .transform((v) => v.toUpperCase()),
  ddi: z.string().regex(/^\+\d{1,4}$/, "DDI no formato +XXX (ex.: +506)"),
  // Fuso IANA de verdade (docs/43 §6 item 6; docs/42 L2429): antes `z.string().min(1)` aceitava "America/SaoPaulo"
  // ou "GMT-3" e quebrava em silêncio as datas do país. Mesmo critério do CampoFuso e do FusoInstitucionalSchema.
  fuso: z.string().trim().min(1, MSG_FUSO_PAIS_VAZIO).max(100, MSG_FUSO_PAIS_INVALIDO).refine((fuso) => fuso === "" || fusoIanaValido(fuso), MSG_FUSO_PAIS_INVALIDO).default("America/Sao_Paulo"),
  idioma: z.string().min(1).default("es"),
  tiposDocumento: z.array(TipoDocumentoSchema).default([]).refine((tipos) => {
    const nomes = tipos.map((t) => t.nome.trim().toLocaleLowerCase("pt-BR"));
    return new Set(nomes).size === nomes.length;
  }, "Cada tipo de documento deve ter um nome distinto"),
});

export type PaisInput = z.input<typeof PaisSchema>;
export type PaisOutput = z.output<typeof PaisSchema>;
