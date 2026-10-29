import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ARQUIVO = resolve(process.cwd(), ".github/workflows/image.yml");
const CI = resolve(process.cwd(), ".github/workflows/ci.yml");

const ATTEST =
  "actions/attest-build-provenance@4d101475d8b20a2381f78447822ac1eab6504dd8";

const NOMES_DE_CHECK_DO_CI = [
  "lint",
  "typecheck",
  "test (UTC)",
  "test (America/Sao_Paulo)",
  "build",
  "test (${{ matrix.tz }})",
] as const;

const PUBLICA =
  "(github.event_name == 'push' || github.event_name == 'workflow_dispatch') && github.ref == 'refs/heads/main'";

function ler(caminho: string): string {
  return readFileSync(caminho, "utf8").replace(/\r\n/g, "\n");
}

function blocosDeJob(texto: string): { id: string; corpo: string }[] {
  const jobs = texto.split(/^jobs:\n/m)[1];
  if (!jobs) throw new Error("workflow sem jobs");
  return jobs
    .split(/\n(?=  [A-Za-z0-9_-]+:\n)/)
    .map((parte) => parte.replace(/^\n/, ""))
    .filter((parte) => /^  [A-Za-z0-9_-]+:\n/.test(parte))
    .map((corpo) => {
      const id = corpo.match(/^  ([A-Za-z0-9_-]+):/)?.[1] ?? "";
      return { id, corpo };
    });
}

function nomeDoJob(corpo: string): string {
  const nome = corpo.match(/^    name: (.+)$/m)?.[1];
  if (!nome) throw new Error("job sem name");
  return nome;
}

function permissionsDoJob(corpo: string): string[] {
  const bloco = corpo.match(/^    permissions:\n((?:      [^\n]+\n)+)/m)?.[1] ?? "";
  return bloco
    .split("\n")
    .map((linha) => linha.trim())
    .filter(Boolean);
}

describe("image.yml produz o que o deployer consome", () => {
  const texto = ler(ARQUIVO);
  const jobs = blocosDeJob(texto);
  const porId = Object.fromEntries(jobs.map((job) => [job.id, job.corpo]));

  it("dispara em push na main, em workflow_dispatch e, em PR, só no alvo main", () => {
    const on = texto.split(/^jobs:\n/m)[0] ?? "";
    expect(on).toMatch(/^on:\n/m);
    expect(on).toMatch(/push:\n\s+branches: \[main\]\n/);
    expect(on).toMatch(/pull_request:\n\s+branches: \[main\]\n/);
    expect(on).toMatch(/workflow_dispatch:\n/);
    expect(on).not.toMatch(/^\s+tags:/m);
  });

  it("enfileira a main sem cancelar e não mistura o grupo com o de um PR", () => {
    expect(texto).toContain("group: ${{ github.event_name == 'pull_request' && format('image-pr-{0}', github.event.pull_request.number) || 'image-main' }}");
    expect(texto).toMatch(/^  cancel-in-progress: false$/m);
    expect(texto).not.toMatch(/cancel-in-progress:\s*\$\{\{/);
    expect(texto).not.toContain("group: image-${{ github.ref }}");
  });

  it("não cria os nomes de check do ci.yml", () => {
    const nomes = jobs.map((job) => nomeDoJob(job.corpo));
    const ids = jobs.map((job) => job.id);
    for (const proibido of NOMES_DE_CHECK_DO_CI) {
      expect(nomes, proibido).not.toContain(proibido);
      expect(ids, proibido).not.toContain(proibido);
    }
    expect(texto).not.toContain("tz: [UTC, America/Sao_Paulo]");
    const doCi = blocosDeJob(ler(CI)).map((job) => nomeDoJob(job.corpo));
    for (const nome of nomes) expect(doCi, nome).not.toContain(nome);
  });

  it("em push o check é build Next.js; em workflow_dispatch o nome é outro", () => {
    const nome = nomeDoJob(porId["build-next"] ?? "");
    expect(nome).toBe(
      "${{ github.event_name == 'workflow_dispatch' && 'imagens (dispatch)' || 'build Next.js' }}",
    );
    expect(ler(CI)).not.toContain("name: build Next.js");
    expect(ler(CI)).not.toContain("imagens (dispatch)");
    for (const proibido of NOMES_DE_CHECK_DO_CI) {
      expect(proibido).not.toBe("imagens (dispatch)");
      expect(proibido).not.toBe("build Next.js");
    }
  });

  it("só publica na main, em push ou workflow_dispatch", () => {
    const publicar = porId.publicar ?? "";
    expect(publicar).toContain(`if: \${{ ${PUBLICA} && needs.build-next.result == 'success' }}`);
    expect(publicar).toContain(`push: \${{ ${PUBLICA} }}`);
    expect(texto).not.toMatch(/^(\s*)push:\s*true\s*$/m);
    const pr = porId["imagens-pr"] ?? "";
    expect(pr).toContain("if: github.event_name == 'pull_request'");
    expect(pr).toMatch(/^          push: false$/m);
    expect(pr).not.toContain("attest-build-provenance");
    expect(pr).not.toContain("docker/login-action");
    expect(pr).not.toContain("secrets.");
  });

  it("atesta os dois digests no registry, sem predicado customizado", () => {
    const publicar = porId.publicar ?? "";
    expect(publicar.split(ATTEST).length - 1).toBe(2);
    expect(publicar.split("push-to-registry: true").length - 1).toBe(2);
    expect(publicar).toContain("subject-digest: ${{ steps.push-app.outputs.digest }}");
    expect(publicar).toContain("subject-digest: ${{ steps.push-migrate.outputs.digest }}");
    const registro = ["env", "REGISTRY"].join(".");
    const imagem = ["env", "IMAGE_NAME"].join(".");
    expect(publicar).toContain(`subject-name: \${{ ${registro} }}/\${{ ${imagem} }}`);
    expect(publicar).toContain(`subject-name: \${{ ${registro} }}/\${{ ${imagem} }}/migrate`);
    expect(publicar).not.toMatch(/^\s+predicate:/m);
    expect(publicar).not.toContain("predicate-path:");
    expect(publicar).not.toContain("github-token:");
  });

  it("etiqueta só sha-<7>, que é a tag que o deployer resolve", () => {
    const publicar = porId.publicar ?? "";
    const tags = publicar.match(/type=sha,format=short,prefix=sha-/g) ?? [];
    expect(tags).toHaveLength(2);
    expect(publicar.match(/latest=false/g) ?? []).toHaveLength(2);
    expect(publicar).not.toContain("type=ref");
    expect(publicar).not.toContain("type=semver");
    expect(publicar).not.toContain("type=raw");
  });

  it("grava o commit da main no build das duas imagens", () => {
    const ocorrencias = texto.match(/GIT_SHA=\$\{\{ github\.sha \}\}/g) ?? [];
    expect(ocorrencias.length).toBeGreaterThanOrEqual(4);
  });

  it("fixa toda action por SHA de 40 hex", () => {
    const uses = [...texto.matchAll(/uses:\s*(\S+)/g)].map((achado) => achado[1] ?? "");
    expect(uses.length).toBeGreaterThan(0);
    for (const uso of uses) {
      expect(uso, uso).toMatch(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+@[0-9a-f]{40}$/);
    }
  });

  it("dá a cada job só as permissions que ele usa", () => {
    expect(permissionsDoJob(porId["build-next"] ?? "")).toEqual(["contents: read"]);
    expect(permissionsDoJob(porId["imagens-pr"] ?? "")).toEqual(["contents: read"]);
    expect(permissionsDoJob(porId.publicar ?? "").sort()).toEqual(
      ["attestations: write", "contents: read", "id-token: write", "packages: write"].sort(),
    );
    expect(texto).not.toMatch(/contents: write|pull-requests:|actions: write|security-events:/);
  });

  it("não coloca segredo em argv nem segredo de deploy no workflow", () => {
    const linhas = texto.split("\n").filter((linha) => linha.includes("secrets."));
    expect(linhas).toEqual(["          password: ${{ secrets.GITHUB_TOKEN }}"]);
    expect(texto).not.toMatch(/\|\|\s*true/);
    expect(texto).not.toMatch(/environment:/);
    expect(texto).not.toMatch(/COOLIFY|SSH_KEY|DEPLOY_TOKEN|DEPLOY_WINDOW/);
  });
});
