"use client";

import { signOut } from "next-auth/react";

export function SairPortal() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="text-sm text-gray-500 hover:text-gray-800"
    >
      Sair
    </button>
  );
}
