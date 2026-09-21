/**
 * Credenciais exclusivamente de servidor para o Drive institucional.
 * A biblioteca oficial mantém o token e faz a renovação; este módulo nunca
 * serializa credenciais para o cliente nem registra valores de configuração.
 */
import { JWT } from "google-auth-library";

const ESCOPO_DRIVE_LEITURA = "https://www.googleapis.com/auth/drive.readonly";
const ERRO_CONFIGURACAO = "Configuração de gravações indisponível.";
const ID_DRIVE = /^[A-Za-z0-9_-]{3,500}$/;

export class ErroCredenciaisDrive extends Error {
  constructor() {
    super(ERRO_CONFIGURACAO);
  }
}

export type ClienteTokenDrive = {
  getAccessToken(): Promise<{ token?: string | null }>;
};

export type CredenciaisDrive = {
  email: string;
  chavePrivada: string;
  scopes: [typeof ESCOPO_DRIVE_LEITURA];
};

export type CriarClienteTokenDrive = (credenciais: CredenciaisDrive) => ClienteTokenDrive;

type AmbienteDrive = {
  GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL?: string;
  GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY?: string;
  DRIVE_ORGANIZACAO_ID?: string;
};

type OpcoesTokenDrive = {
  ambiente?: AmbienteDrive;
  criarCliente?: CriarClienteTokenDrive;
};

let clienteOficialEmCache: { email: string; chavePrivada: string; cliente: ClienteTokenDrive } | null = null;

function valorObrigatorio(valor: string | undefined) {
  const limpo = valor?.trim();
  if (!limpo) throw new ErroCredenciaisDrive();
  return limpo;
}

function lerCredenciais(ambiente: AmbienteDrive): CredenciaisDrive {
  const email = valorObrigatorio(ambiente.GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL);
  const chavePrivada = valorObrigatorio(ambiente.GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY).replace(/\\n/g, "\n");
  if (!email.includes("@") || !chavePrivada.includes("-----BEGIN PRIVATE KEY-----")) throw new ErroCredenciaisDrive();
  return { email, chavePrivada, scopes: [ESCOPO_DRIVE_LEITURA] };
}

function criarClienteOficial(credenciais: CredenciaisDrive): ClienteTokenDrive {
  return new JWT({
    email: credenciais.email,
    key: credenciais.chavePrivada,
    scopes: credenciais.scopes,
  });
}

function obterCliente(credenciais: CredenciaisDrive, criarCliente?: CriarClienteTokenDrive) {
  if (criarCliente) return criarCliente(credenciais);
  if (clienteOficialEmCache?.email === credenciais.email && clienteOficialEmCache.chavePrivada === credenciais.chavePrivada) {
    return clienteOficialEmCache.cliente;
  }
  const cliente = criarClienteOficial(credenciais);
  clienteOficialEmCache = { email: credenciais.email, chavePrivada: credenciais.chavePrivada, cliente };
  return cliente;
}

/**
 * Obtém um bearer de serviço com o escopo mínimo de leitura do Drive. A
 * instância JWT é reutilizada, portanto cache e renovação são do cliente oficial.
 */
export async function obterTokenDrive(opcoes: OpcoesTokenDrive = {}): Promise<string> {
  try {
    const credenciais = lerCredenciais(opcoes.ambiente ?? process.env as AmbienteDrive);
    const resposta = await obterCliente(credenciais, opcoes.criarCliente).getAccessToken();
    const token = resposta.token?.trim();
    if (!token) throw new Error("token ausente");
    return token;
  } catch {
    throw new ErroCredenciaisDrive();
  }
}

/** Lê o drive compartilhado da organização somente quando o adaptador é usado. */
export function obterDriveOrganizacaoId(ambiente: AmbienteDrive = process.env as AmbienteDrive): string {
  const driveId = valorObrigatorio(ambiente.DRIVE_ORGANIZACAO_ID);
  if (!ID_DRIVE.test(driveId)) throw new ErroCredenciaisDrive();
  return driveId;
}
