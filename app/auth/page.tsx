"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL;

export default function AuthPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"in" | "up">("in");
  const [forgot, setForgot] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotSent, setForgotSent] = useState(false);

  const switchTab = (t: "in" | "up") => {
    setTab(t);
    setError(null);
    setMessage(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    const supabase = createClient();

    if (tab === "up") {
      const { error } = await supabase.auth.signUp({
        email,
        password: pass,
        options: {
          data: {
            display_name: (displayName || "PLAYER1").toUpperCase().slice(0, 10),
          },
          emailRedirectTo: `${SITE_URL}/auth/callback`,
        },
      });
      setLoading(false);
      if (error) {
        setError(error.message);
        return;
      }
      setMessage("Revisa tu correo para confirmar tu cuenta.");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: pass,
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/games");
  };

  const guestLogin = () => {
    router.push("/games");
  };

  const oauth = async (provider: "google" | "github") => {
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${SITE_URL}/auth/callback` },
    });
    if (error) setError(error.message);
  };

  const openForgot = () => {
    setForgot(true);
    setForgotEmail(email);
    setForgotError(null);
    setForgotSent(false);
  };

  const submitForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError(null);
    setForgotLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${SITE_URL}/auth/callback`,
    });
    setForgotLoading(false);
    if (error) {
      setForgotError(error.message);
      return;
    }
    setForgotSent(true);
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
            ACCESO AL SISTEMA · v2.6
          </div>
        </div>

        {forgot ? (
          <>
            <form onSubmit={submitForgot}>
              <div className="field">
                <label>Correo electrónico</label>
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="jugador@vault.gg"
                  disabled={forgotSent}
                />
              </div>

              {!forgotSent ? (
                <button
                  className="btn lg"
                  type="submit"
                  disabled={forgotLoading || forgotEmail.trim().length === 0}
                  style={{ width: "100%", marginTop: 8 }}
                >
                  {forgotLoading ? "ENVIANDO…" : "ENVIAR ENLACE"}
                </button>
              ) : (
                <div
                  className="mono"
                  style={{ color: "var(--cyan)", fontSize: 12, marginTop: 8 }}
                >
                  Revisa tu correo para continuar.
                </div>
              )}

              {forgotError && (
                <div
                  style={{
                    color: "var(--magenta)",
                    fontSize: 11,
                    marginTop: 8,
                  }}
                >
                  {forgotError}
                </div>
              )}
            </form>

            <button
              className="btn ghost"
              style={{ width: "100%", marginTop: 10 }}
              onClick={() => setForgot(false)}
            >
              ← VOLVER A INICIAR SESIÓN
            </button>
          </>
        ) : (
          <>
            <div className="auth-tabs">
              <button
                className={tab === "in" ? "on" : ""}
                onClick={() => switchTab("in")}
              >
                INICIAR SESIÓN
              </button>
              <button
                className={tab === "up" ? "on" : ""}
                onClick={() => switchTab("up")}
              >
                CREAR CUENTA
              </button>
            </div>

            <form onSubmit={submit}>
              {tab === "up" && (
                <div className="field slide-in">
                  <label>Usuario</label>
                  <input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="px_kai"
                    maxLength={10}
                  />
                </div>
              )}
              <div className="field">
                <label>Correo electrónico</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jugador@vault.gg"
                />
              </div>
              <div className="field">
                <label>Contraseña</label>
                <input
                  type="password"
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  placeholder="••••••••"
                />
              </div>

              {tab === "in" && (
                <button
                  type="button"
                  className="mono"
                  onClick={openForgot}
                  style={{
                    background: "none",
                    border: 0,
                    padding: 0,
                    color: "var(--ink-faint)",
                    fontSize: 11,
                    letterSpacing: "0.08em",
                    cursor: "pointer",
                    marginBottom: 4,
                  }}
                >
                  ¿Olvidaste tu contraseña?
                </button>
              )}

              <button
                className="btn lg"
                type="submit"
                disabled={
                  loading || email.trim().length === 0 || pass.length === 0
                }
                style={{ width: "100%", marginTop: 8 }}
              >
                {loading
                  ? tab === "in"
                    ? "ENTRANDO…"
                    : "CREANDO…"
                  : tab === "in"
                    ? "ENTRAR AL VAULT"
                    : "CREAR Y JUGAR"}
              </button>

              {message && (
                <div
                  style={{ color: "var(--cyan)", fontSize: 12, marginTop: 10 }}
                >
                  {message}
                </div>
              )}
              {error && (
                <div
                  style={{
                    color: "var(--magenta)",
                    fontSize: 11,
                    marginTop: 10,
                  }}
                >
                  {error}
                </div>
              )}
            </form>

            <button
              className="btn ghost"
              style={{ width: "100%", marginTop: 10 }}
              onClick={guestLogin}
            >
              JUGAR COMO INVITADO
            </button>

            <div className="auth-divider">O CONTINÚA CON</div>
            <div className="social">
              <button
                className="btn ghost"
                type="button"
                onClick={() => oauth("google")}
              >
                ◆&nbsp; GOOGLE
              </button>
              <button
                className="btn ghost"
                type="button"
                onClick={() => oauth("github")}
              >
                ▣&nbsp; GITHUB
              </button>
            </div>
          </>
        )}

        <div
          style={{
            marginTop: 18,
            textAlign: "center",
            fontSize: 11,
            color: "var(--ink-faint)",
            letterSpacing: "0.1em",
          }}
        >
          AL ENTRAR ACEPTAS LOS TÉRMINOS DEL SALÓN ARCADE
        </div>
      </div>
    </div>
  );
}
