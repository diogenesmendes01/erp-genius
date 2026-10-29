import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  MENSAGEM_SHA_DESATUALIZADO,
  QA_COMMAND_PATTERN,
  QA_STATUS_CONTEXT,
  ROTULO_FAIL,
  ROTULO_PASS,
  decidirQaGate,
  parseComandoQa,
} from "./parse";

const SHA = "0123456789abcdef0123456789abcdef01234567";
const OUTRO = "fedcba9876543210fedcba9876543210fedcba98";

const workflow = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../../.github/workflows/qa-gate.yml"),
  "utf8",
);

function base(overrides: Partial<Parameters<typeof decidirQaGate>[0]> = {}) {
  return {
    authorAssociation: "OWNER" as const,
    body: `/qa-pass ${SHA}`,
    headSha: SHA,
    commentUrl: "https://github.com/acme/erp/pull/7#issuecomment-42",
    commentId: 42,
    ...overrides,
  };
}

describe("parseComandoQa", () => {
  it("aceita /qa-pass com sha de 40 hex minúsculos", () => {
    expect(parseComandoQa(`/qa-pass ${SHA}`)).toEqual({ verdict: "pass", sha: SHA });
  });

  it("aceita /qa-fail com sha de 40 hex minúsculos", () => {
    expect(parseComandoQa(`/qa-fail ${SHA}`)).toEqual({ verdict: "fail", sha: SHA });
  });

  it("recusa sha curto", () => {
    expect(parseComandoQa(`/qa-pass ${SHA.slice(0, 39)}`)).toBeNull();
    expect(parseComandoQa("/qa-pass abc")).toBeNull();
  });

  it("recusa sha maiúsculo", () => {
    expect(parseComandoQa(`/qa-pass ${SHA.toUpperCase()}`)).toBeNull();
    expect(parseComandoQa(`/qa-fail ${SHA.slice(0, 39)}A`)).toBeNull();
  });

  it("recusa sha com 41 caracteres", () => {
    expect(parseComandoQa(`/qa-pass ${SHA}a`)).toBeNull();
  });

  it("recusa texto antes do comando", () => {
    expect(parseComandoQa(`libera /qa-pass ${SHA}`)).toBeNull();
    expect(parseComandoQa(`pode seguir\n/qa-pass ${SHA}`)).toBeNull();
  });

  it("recusa comando só na segunda linha", () => {
    expect(parseComandoQa(`\n/qa-pass ${SHA}`)).toBeNull();
    expect(parseComandoQa(`ok\n/qa-fail ${SHA}`)).toBeNull();
  });

  it("aceita comando na primeira linha mesmo com texto depois", () => {
    expect(parseComandoQa(`  /qa-pass ${SHA}  \nnota interna`)).toEqual({
      verdict: "pass",
      sha: SHA,
    });
  });
});

describe("decidirQaGate", () => {
  it("publica success quando o sha do /qa-pass coincide com o head", () => {
    const decisao = decidirQaGate(base());
    expect(decisao).toMatchObject({
      action: "status",
      sha: SHA,
      state: "success",
      context: QA_STATUS_CONTEXT,
      targetUrl: "https://github.com/acme/erp/pull/7#issuecomment-42",
    });
    if (decisao.action !== "status") return;
    expect(decisao.description.length).toBeLessThanOrEqual(140);
    expect(decisao.description).toContain(ROTULO_PASS);
    expect(decisao.description).toContain("issuecomment-42");
  });

  it("publica failure quando o sha do /qa-fail coincide com o head", () => {
    const decisao = decidirQaGate(base({ body: `/qa-fail ${SHA}` }));
    expect(decisao).toMatchObject({
      action: "status",
      state: "failure",
      sha: SHA,
    });
    if (decisao.action !== "status") return;
    expect(decisao.description).toContain(ROTULO_FAIL);
    expect(decisao.description.length).toBeLessThanOrEqual(140);
  });

  it("não publica status quando o sha diverge e devolve a falha com o head atual", () => {
    expect(decidirQaGate(base({ headSha: OUTRO }))).toEqual({
      action: "stale",
      headSha: OUTRO,
      message: `${MENSAGEM_SHA_DESATUALIZADO}${OUTRO}`,
    });
  });

  it.each(["NONE", "CONTRIBUTOR", "FIRST_TIME_CONTRIBUTOR", "MANNEQUIN", ""])(
    "ignora associação não autorizada (%s) mesmo com comando válido",
    (authorAssociation) => {
      expect(decidirQaGate(base({ authorAssociation, headSha: OUTRO })).action).toBe("ignore");
    },
  );

  it("ignora associação ausente", () => {
    expect(decidirQaGate(base({ authorAssociation: null })).action).toBe("ignore");
    expect(decidirQaGate(base({ authorAssociation: undefined })).action).toBe("ignore");
  });

  it.each(["OWNER", "MEMBER", "COLLABORATOR"])("aceita associação %s", (authorAssociation) => {
    expect(decidirQaGate(base({ authorAssociation })).action).toBe("status");
  });
});

describe("descricao do status", () => {
  it("cai para o id do comentário quando a url estoura 140 caracteres", () => {
    const commentUrl = `https://github.com/${"organizacao-longa".repeat(8)}/erp/pull/1#issuecomment-99`;
    const decisao = decidirQaGate(base({ commentUrl, commentId: 99 }));
    expect(decisao.action).toBe("status");
    if (decisao.action !== "status") return;
    expect(decisao.description.length).toBeLessThanOrEqual(140);
    expect(decisao.description).toContain("99");
    expect(decisao.description).not.toContain(commentUrl);
    expect(decisao.targetUrl).toBe(commentUrl);
  });
});

describe("workflow qa-gate", () => {
  it("repete a regex do módulo, sem interpolar o corpo do comentário", () => {
    expect(QA_COMMAND_PATTERN).toBe("^/qa-(pass|fail) ([0-9a-f]{40})$");
    expect(workflow).toContain(QA_COMMAND_PATTERN);
    expect(workflow).toContain(MENSAGEM_SHA_DESATUALIZADO);
    expect(workflow).toContain(QA_STATUS_CONTEXT);
    expect(workflow).toContain(ROTULO_PASS);
    expect(workflow).toContain(ROTULO_FAIL);
    expect(workflow).not.toMatch(/\$\{\{\s*github\.event\.comment\.body/);
    expect(workflow).toContain("context.payload.comment");
    expect(workflow).not.toContain("actions/checkout");
    expect(workflow).toContain("github.rest.pulls.get");
    expect(workflow).toContain("github.rest.repos.createCommitStatus");
    expect(workflow).toContain("core.setFailed");
    expect(workflow).not.toMatch(/issues\.createComment|pulls\.createReviewComment/);
  });

  it("declara só statuses write e pull-requests read", () => {
    const linhas = workflow.split("\n");
    const inicio = linhas.findIndex((linha) => linha === "permissions:");
    const fim = linhas.findIndex((linha, indice) => indice > inicio && linha === "jobs:");
    const permissoes = linhas
      .slice(inicio + 1, fim)
      .map((linha) => linha.trim())
      .filter((linha) => linha.length > 0 && !linha.startsWith("#"));
    expect(permissoes.sort()).toEqual(["pull-requests: read", "statuses: write"]);
  });

  it("só roda em comentário de pull request e usa github-script pinado por SHA", () => {
    expect(workflow).toMatch(/issue_comment:\n\s+types:\s+\[created\]/);
    expect(workflow).toContain("github.event.issue.pull_request");
    expect(workflow).toMatch(
      /uses: actions\/github-script@[0-9a-f]{40} # v\d+\.\d+\.\d+/,
    );
  });
});
