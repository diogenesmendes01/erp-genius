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
  async atualizarPerfil(ref, p) {
    if (p.nome !== undefined || p.recado !== undefined) {
      await executarAcaoMotor(ref, "profile.update", {
        ...(p.nome !== undefined ? { name: p.nome } : {}),
        ...(p.recado !== undefined ? { about: p.recado } : {}),
      });
    }
    if (p.fotoDataUri) await executarAcaoMotor(ref, "profile.picture", { image: p.fotoDataUri });
  },
  async atualizarPrivacidade(ref, p) {
    for (const campo of Object.keys(AJUSTE) as (keyof PrivacidadeNumero)[]) {
      const v = p[campo];
      if (v) await executarAcaoMotor(ref, "privacy.update", { setting: AJUSTE[campo], value: valorPrivacidade(campo, v) });
    }
  },
  // Padrão para conversas novas (defaultDisappearing); conversas já abertas não mudam.
  async definirTemporarias(ref, segundos) {
    await executarAcaoMotor(ref, "privacy.update", { setting: "defaultDisappearing", value: segundos });
  },
};
