import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";

function isSameOriginPath(value: string | null, origin: string): boolean {
  if (!value) return false;
  try {
    return new URL(value, origin).origin === origin;
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const origin = request.nextUrl.origin;

  const nextParam = request.nextUrl.searchParams.get("next");
  // Solo se acepta un destino que resuelva al mismo origen (nunca una URL
  // absoluta externa, protocol-relative, ni un bypass con backslash), para
  // no abrir un open redirect via ?next=.
  const next = isSameOriginPath(nextParam, origin) ? nextParam! : "/games";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, origin));
    }
    console.error("auth/callback: exchangeCodeForSession falló", error);
  }

  return NextResponse.redirect(new URL("/auth?error=auth", origin));
}
