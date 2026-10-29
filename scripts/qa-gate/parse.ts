export const QA_COMMAND_PATTERN = "^/qa-(pass|fail) ([0-9a-f]{40})$";

export const QA_STATUS_CONTEXT = "qa/homologacao";

export const MENSAGEM_SHA_DESATUALIZADO = "sha desatualizado: head atual é ";

export const ROTULO_PASS = "Homologação QA aprovada";

export const ROTULO_FAIL = "Homologação QA reprovada";

const LIMITE_DESCRICAO = 140;

const comando = new RegExp(QA_COMMAND_PATTERN);

export type VereditoQa = "pass" | "fail";

export type ComandoQa = {
  verdict: VereditoQa;
  sha: string;
};

export type DecisaoQa =
  | { action: "ignore" }
  | { action: "stale"; headSha: string; message: string }
  | {
      action: "status";
      sha: string;
      state: "success" | "failure";
      context: typeof QA_STATUS_CONTEXT;
      targetUrl: string;
      description: string;
    };

const ASSOCIACOES = new Set(["OWNER", "MEMBER", "COLLABORATOR"]);

export function parseComandoQa(body: string): ComandoQa | null {
  const linha = (body.split(/\r?\n/, 1)[0] ?? "").trim();
  const match = comando.exec(linha);
  if (!match) return null;
  const verdict = match[1];
  const sha = match[2];
  if ((verdict !== "pass" && verdict !== "fail") || sha === undefined) return null;
  return { verdict, sha };
}

export function descricaoStatus(
  verdict: VereditoQa,
  commentUrl: string,
  commentId: number | string,
): string {
  const rotulo = verdict === "pass" ? ROTULO_PASS : ROTULO_FAIL;
  const comUrl = `${rotulo}. Comentário: ${commentUrl}`;
  if (commentUrl && comUrl.length <= LIMITE_DESCRICAO) return comUrl;
  const comId = `${rotulo} (comentário ${commentId})`;
  return comId.length <= LIMITE_DESCRICAO ? comId : comId.slice(0, LIMITE_DESCRICAO);
}

export function decidirQaGate(input: {
  authorAssociation: string | null | undefined;
  body: string;
  headSha: string;
  commentUrl: string;
  commentId: number | string;
}): DecisaoQa {
  if (!input.authorAssociation || !ASSOCIACOES.has(input.authorAssociation)) {
    return { action: "ignore" };
  }
  const comandoQa = parseComandoQa(input.body);
  if (!comandoQa) return { action: "ignore" };
  if (input.headSha !== comandoQa.sha) {
    return {
      action: "stale",
      headSha: input.headSha,
      message: `${MENSAGEM_SHA_DESATUALIZADO}${input.headSha}`,
    };
  }
  return {
    action: "status",
    sha: input.headSha,
    state: comandoQa.verdict === "pass" ? "success" : "failure",
    context: QA_STATUS_CONTEXT,
    targetUrl: input.commentUrl,
    description: descricaoStatus(comandoQa.verdict, input.commentUrl, input.commentId),
  };
}
