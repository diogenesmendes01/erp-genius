const NUM = String.raw`[-+]?\d{1,3}(?:\.\d+)?`;
const PAR = new RegExp(String.raw`^(${NUM})\s*[,;\s]\s*(${NUM})$`);
const PADROES = [
  new RegExp(String.raw`!3d(${NUM})!4d(${NUM})`),
  new RegExp(String.raw`[?&](?:q|query|ll|destination)=(?:loc:)?(${NUM}),\s*(${NUM})`),
  new RegExp(String.raw`@(${NUM}),(${NUM})`),
];
const LINK_CURTO = /^(?:https?:\/\/)?(?:maps\.app\.goo\.gl|goo\.gl\/maps)\//i;

export function ehLinkCurtoMapa(texto: string): boolean {
  return LINK_CURTO.test(texto.trim());
}

function decodificar(texto: string): string {
  try { return decodeURIComponent(texto); } catch { return texto; }
}

function noIntervalo(lat: string, lng: string): { latitude: number; longitude: number } | null {
  const latitude = Number(lat), longitude = Number(lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
}

export function lerCoordenadas(texto: string): { latitude: number; longitude: number } | null {
  const limpo = decodificar(texto.trim()).replace(/\s+/g, " ");
  if (!limpo) return null;
  const par = PAR.exec(limpo);
  if (par) return noIntervalo(par[1], par[2]);
  for (const padrao of PADROES) {
    const m = padrao.exec(limpo);
    if (m) return noIntervalo(m[1], m[2]);
  }
  return null;
}
