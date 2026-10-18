import { executarAcaoMotor } from "./acoes";
import { ErroMotor } from "./cliente";

// Cliente do motor para o PERFIL do número (docs do motor: MODO-SERVICO.md · BAILEYS-API.md).
// Ações `profile.update`, `profile.picture`, `privacy.update` e `chat.ephemeral`/`defaultDisappearing`,
// todas via POST /v1/numeros/:ref/acoes. Só o ADMINISTRADOR chega aqui (a restrição é do ERP).

export type Visibilidade = "TODOS" | "CONTATOS" | "NINGUEM";
export const SEGUNDOS_TEMPORARIAS = [0, 86400, 604800, 7776000] as const;
export type SegundosTemporarias = (typeof SEGUNDOS_TEMPORARIAS)[number];

export interface PrivacidadeNumero {
  vistoPorUltimo: Visibilidade;
  foto: Visibilidade;
  recado: Visibilidade;
  grupos: Visibilidade;
}

export const MSG_RECURSO_INDISPONIVEL = "Recurso ainda não disponível no motor.";

/** Contrato injetável (testes usam um duplo; produção usa `clienteMotorNumero`). */
export interface ClienteMotorNumero {
  atualizarPerfil(numeroRef: string, p: { nome?: string; recado?: string; fotoDataUri?: string }): Promise<void>;
  atualizarPrivacidade(numeroRef: string, p: Partial<PrivacidadeNumero>): Promise<void>;
  definirTemporarias(numeroRef: string, segundos: SegundosTemporarias): Promise<void>;
}

/**
 * Uma chamada ao motor falhou depois de outras já aplicadas: `aplicado` diz o que o motor JÁ tem,
 * para o ERP gravar só essa parte e não ficar dessincronizado.
 */
export class ErroMotorParcial extends Error {
  constructor(readonly aplicado: { foto?: true; privacidade?: Partial<PrivacidadeNumero> }, readonly causa: unknown) {
    super("aplicacao_parcial_no_motor");
  }
}

const VALOR: Record<Visibilidade, string> = { TODOS: "all", CONTATOS: "contacts", NINGUEM: "none" };

/** Quem pode adicionar o número a grupos não tem a opção "ninguém" no WhatsApp. */
export function valorPrivacidade(campo: keyof PrivacidadeNumero, v: Visibilidade): string {
  if (campo === "grupos" && v === "NINGUEM") throw new ErroMotor("ACAO_NAO_DISPONIVEL", 403, "grupos_sem_ninguem");
  return VALOR[v];
}

const AJUSTE: Record<keyof PrivacidadeNumero, string> = {
  vistoPorUltimo: "lastSeen",
  foto: "profilePicture",
  recado: "status",
  grupos: "groupsAdd",
};

export const clienteMotorNumero: ClienteMotorNumero = {
  // Foto PRIMEIRO (é a que mais falha: tamanho/formato); falhando ela, nada foi aplicado.
  async atualizarPerfil(ref, p) {
    if (p.fotoDataUri) await executarAcaoMotor(ref, "profile.picture", { image: p.fotoDataUri });
    if (p.nome !== undefined || p.recado !== undefined) {
      try {
        await executarAcaoMotor(ref, "profile.update", {
          ...(p.nome !== undefined ? { name: p.nome } : {}),
          ...(p.recado !== undefined ? { about: p.recado } : {}),
        });
      } catch (e) {
        if (p.fotoDataUri) throw new ErroMotorParcial({ foto: true }, e);
        throw e;
      }
    }
  },
  async atualizarPrivacidade(ref, p) {
    const campos = (Object.keys(AJUSTE) as (keyof PrivacidadeNumero)[]).filter((c) => p[c]);
    for (const campo of campos) valorPrivacidade(campo, p[campo]!); // valida tudo antes da 1ª chamada
    const aplicadas: Partial<PrivacidadeNumero> = {};
    for (const campo of campos) {
      try {
        await executarAcaoMotor(ref, "privacy.update", { setting: AJUSTE[campo], value: valorPrivacidade(campo, p[campo]!) });
      } catch (e) {
        if (Object.keys(aplicadas).length) throw new ErroMotorParcial({ privacidade: aplicadas }, e);
        throw e;
      }
      aplicadas[campo] = p[campo];
    }
  },
  // Padrão para conversas novas (defaultDisappearing); conversas já abertas não mudam.
  async definirTemporarias(ref, segundos) {
    await executarAcaoMotor(ref, "privacy.update", { setting: "defaultDisappearing", value: segundos });
  },
};
