"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { validatePassword } from "@/app/auth/password";
import { getAuthErrorMessage } from "@/app/auth/errors";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);
  const [pass, setPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Guard de sesión: sin sesión activa no hay nada que resetear, así que se
  // redirige a /auth. Se espera a que getSession() resuelva antes de decidir
  // (en vez de redirigir en el primer render vacío) para no expulsar a quien
  // vuelve de /auth/callback justo cuando la sesión de recovery todavía se
  // está estableciendo.
  useEffect(() => {
    let active = true;
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active) return;
      if (!session) {
        router.replace("/auth");
        return;
      }
      setCheckingSession(false);
    });
    return () => {
      active = false;
    };
  }, [router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const passwordError = validatePassword(pass);
    if (passwordError) {
      setError(passwordError);
      return;
    }
    if (pass !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: pass });
    setLoading(false);
    if (error) {
      setError(getAuthErrorMessage(error));
      return;
    }
    // Cierra la sesión (de recovery o normal) para que el usuario confirme
    // la contraseña nueva volviendo a loguearse, en vez de quedar en /games
    // con una sesión que ya no tiene sentido mantener abierta.
    await supabase.auth.signOut();
    router.push("/auth");
  };

  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark" />
          <h2 className="neon-cyan">ARCADE VAULT</h2>
          <div
            className="mono"
            style={{
              fontSize: 11,
              color: "var(--ink-faint)",
              letterSpacing: "0.16em",
              marginTop: 6,
            }}
          >
            NUEVA CONTRASEÑA
          </div>
        </div>

        {checkingSession ? (
          <div
            className="mono"
            style={{
              textAlign: "center",
              color: "var(--ink-faint)",
              fontSize: 12,
              padding: "12px 0",
            }}
          >
            VERIFICANDO SESIÓN…
          </div>
        ) : (
          <form onSubmit={submit}>
            <div className="field">
              <label>Nueva contraseña</label>
              <input
                type="password"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <div className="field">
              <label>Confirmar contraseña</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            <button
              className="btn lg"
              type="submit"
              disabled={loading || pass.length === 0 || confirm.length === 0}
              style={{ width: "100%", marginTop: 8 }}
            >
              {loading ? "GUARDANDO…" : "GUARDAR CONTRASEÑA"}
            </button>

            {error && (
              <div
                style={{ color: "var(--magenta)", fontSize: 11, marginTop: 10 }}
              >
                {error}
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
