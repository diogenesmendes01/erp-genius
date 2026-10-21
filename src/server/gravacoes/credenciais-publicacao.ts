import { JWT } from "google-auth-library";
import { ErroCredenciaisDrive, type ClienteTokenDrive } from "./credenciais";

const ESCOPO_PUBLICACAO = "https://www.googleapis.com/auth/drive";
type AmbientePublicacao = {
  GOOGLE_DRIVE_PUBLICACAO_SERVICE_ACCOUNT_EMAIL?: string;
  GOOGLE_DRIVE_PUBLICACAO_SERVICE_ACCOUNT_PRIVATE_KEY?: string;
};
type CredenciaisPublicacao = { email: string; chavePrivada: string; scopes: string[] };
type Opcoes = {
  ambiente?: AmbientePublicacao;
  criarCliente?: (credenciais: CredenciaisPublicacao) => ClienteTokenDrive;
};
let cache: { email: string; chavePrivada: string; cliente: ClienteTokenDrive } | undefined;

/** Token de escrita exclusivo da retenção de revisão. O player continua usando
 * obterTokenDrive readonly; credenciais de publicação devem ser configuradas explicitamente. */
export async function obterTokenPublicacaoDrive(opcoes: Opcoes = {}): Promise<string> {
  try {
    const ambiente = opcoes.ambiente ?? process.env as AmbientePublicacao;
    const email = ambiente.GOOGLE_DRIVE_PUBLICACAO_SERVICE_ACCOUNT_EMAIL?.trim();
    const chavePrivada = ambiente.GOOGLE_DRIVE_PUBLICACAO_SERVICE_ACCOUNT_PRIVATE_KEY?.trim().replace(/\\n/g, "\n");
    if (!email?.includes("@") || !chavePrivada?.includes("-----BEGIN PRIVATE KEY-----")) throw new ErroCredenciaisDrive();
    const credenciais = { email, chavePrivada, scopes: [ESCOPO_PUBLICACAO] };
    let cliente: ClienteTokenDrive;
    if (opcoes.criarCliente) cliente = opcoes.criarCliente(credenciais);
    else {
      if (!cache || cache.email !== email || cache.chavePrivada !== chavePrivada) {
        cache = { email, chavePrivada, cliente: new JWT({ email, key: chavePrivada, scopes: [ESCOPO_PUBLICACAO] }) };
      }
      cliente = cache.cliente;
    }
    const token = (await cliente.getAccessToken()).token?.trim();
    if (!token) throw new ErroCredenciaisDrive();
    return token;
  } catch {
    throw new ErroCredenciaisDrive();
  }
}
