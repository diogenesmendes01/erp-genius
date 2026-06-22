import { z } from "zod";

// Schema compartilhado País (form ↔ ação). Ver docs/04 (país = espinha dorsal).
export const TipoDocumentoSchema = z.object({
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
  fuso: z.string().min(1).default("America/Sao_Paulo"),
  idioma: z.string().min(1).default("es"),
  tiposDocumento: z.array(TipoDocumentoSchema).default([]),
});

export type PaisInput = z.input<typeof PaisSchema>;
export type PaisOutput = z.output<typeof PaisSchema>;
