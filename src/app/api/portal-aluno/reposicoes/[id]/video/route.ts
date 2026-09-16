import { prepararReproducaoContinua } from "@/server/gravacoes/reproducao-continua";
import { criarStreamAutorizado } from "@/server/gravacoes/stream-autorizado";
import { abrirVideoDriveOrganizacional } from "@/server/gravacoes/drive";
import { obterTokenDrive, obterDriveOrganizacaoId } from "@/server/gravacoes/credenciais";
import { origemPortalAlunoPermitida } from "@/server/portal-aluno/politica";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const privados = {
  "Cache-Control": "private, no-store, max-age=0",
  "Cross-Origin-Resource-Policy": "same-origin",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};

/** A URL contém apenas a reposição. O acesso é revalidado também durante o stream. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const site = request.headers.get("sec-fetch-site");
  if ((site && site !== "same-origin" && site !== "none") ||
      (request.headers.has("origin") && !origemPortalAlunoPermitida(request))) {
    return new Response("Reprodução não autorizada.", { status: 403, headers: privados });
  }
  try {
    const { id } = await params;
    const { fonte, revalidar } = await prepararReproducaoContinua(id);
    const video = await abrirVideoDriveOrganizacional({
      fileId: fonte.fileId,
      driveIdOrganizacao: fonte.driveId ?? obterDriveOrganizacaoId(),
      token: obterTokenDrive,
      range: request.headers.get("range"),
      signal: request.signal,
    });
    const headers = new Headers(privados);
    for (const nome of ["Content-Type", "Content-Length", "Content-Range"]) {
      const valor = video.headers.get(nome);
      if (valor) headers.set(nome, valor);
    }
    headers.set("Accept-Ranges", "bytes");
    headers.set("Content-Disposition", "inline");
    return new Response(criarStreamAutorizado({ origem: video.body, revalidar, signal: request.signal }), { status: video.status, headers });
  } catch {
    // Não distinguir IDs alheios, restrições, credenciais ou erros do provedor.
    return new Response("Reprodução indisponível para esta matrícula.", { status: 403, headers: privados });
  }
}
