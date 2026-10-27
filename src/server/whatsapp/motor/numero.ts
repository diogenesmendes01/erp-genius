import { executarAcaoMotor } from "./acoes";
import { ErroMotor } from "./cliente";

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

export interface ClienteMotorNumero {
  atualizarPerfil(numeroRef: string, p: { nome?: string; recado?: string; fotoDataUri?: string }): Promise<void>;
  atualizarPrivacidade(numeroRef: string, p: Partial<PrivacidadeNumero>): Promise<void>;
  definirTemporarias(numeroRef: string, segundos: SegundosTemporarias): Promise<void>;
}

export class ErroMotorParcial extends Error {
  constructor(readonly aplicado: { foto?: true; privacidade?: Partial<PrivacidadeNumero> }, readonly causa: unknown) {
    super("aplicacao_parcial_no_motor");
  }
}

const VALOR: Record<Visibilidade, string> = { TODOS: "all", CONTATOS: "contacts", NINGUEM: "none" };

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
    for (const campo of campos) valorPrivacidade(campo, p[campo]!);
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
  async definirTemporarias(ref, segundos) {
    await executarAcaoMotor(ref, "privacy.update", { setting: "defaultDisappearing", value: segundos });
  },
};
