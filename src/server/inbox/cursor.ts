/** Cursor opaco da paginação (keyset): instante ISO (ou null) + id. Base64url de JSON. */
export interface CursorInbox { em: string | null; id: string }

export function codificarCursor(c: CursorInbox): string {
  return Buffer.from(JSON.stringify({ em: c.em, id: c.id })).toString("base64url");
}

/** Qualquer entrada que não seja um cursor bem formado vira null (a rota trata como "sem cursor"). */
export function decodificarCursor(s: string): CursorInbox | null {
  if (!s || s.length > 512 || !/^[A-Za-z0-9_-]+$/.test(s)) return null;
  try {
    const v: unknown = JSON.parse(Buffer.from(s, "base64url").toString("utf8"));
    if (!v || typeof v !== "object" || Array.isArray(v)) return null;
    const { em, id } = v as { em?: unknown; id?: unknown };
    if (typeof id !== "string" || !id) return null;
    if (em === null) return { em: null, id };
    if (typeof em !== "string" || Number.isNaN(Date.parse(em))) return null;
    return { em, id };
  } catch { return null; }
}
