import { ErroRegra } from "@/server/_shared";

export const CAMPOS_PRAZOS_PORTAL_ALUNO = [
  "prazoSessaoPortalAlunoMinutos",
  "prazoConvitePortalAlunoMinutos",
  "prazoRecuperacaoPortalAlunoMinutos",
  "prazoValidacaoEmailPortalAlunoMinutos",
] as const;
export type CampoPrazoPortalAluno = (typeof CAMPOS_PRAZOS_PORTAL_ALUNO)[number];

/**
 * #536: configuração de prazos do portal do aluno ausente ou incompleta. Estende ErroRegra para
 * que fluxos internos (convite, recuperação, envio) sigam mostrando a mensagem ao operador via
 * executarAcao. Rotas públicas nunca expõem `message`: discriminam só por classe + `codigo`.
 */
export class ErroConfigPortalIncompleta extends ErroRegra {
  readonly codigo = "PORTAL_CONFIG_INCOMPLETA" as const;
  readonly camposAusentes: CampoPrazoPortalAluno[];
  constructor(camposAusentes: CampoPrazoPortalAluno[]) {
    super("Configure todos os prazos do portal do aluno antes de emitir links ou sessões.");
    this.name = "ErroConfigPortalIncompleta";
    this.camposAusentes = [...camposAusentes];
  }
}
