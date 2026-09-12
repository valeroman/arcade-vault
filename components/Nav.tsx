"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { getProfileForUser, type Profile } from "@/app/data/profile";

type SessionStatus = "loading" | "in" | "out";

// Componente aparte (no un `if` inline) para que su propio estado
// `broken` pueda resetearse montándolo de nuevo: el padre le pasa
// `key={avatar_url}`, así un cambio de perfil/URL siempre arranca en
// `broken = false` sin necesitar un useEffect que sincronice estado
// derivado de una prop (patrón desaconsejado por las reglas de hooks).
function PlayerAvatar({
  avatarUrl,
  initial,
}: {
  avatarUrl: string | null;
  initial: string;
}) {
  const [broken, setBroken] = useState(false);
  if (!avatarUrl || broken) {
    return <span className="av-player-tile">{initial}</span>;
  }
  return (
    <img
      src={avatarUrl}
      alt=""
      width={32}
      height={32}
      referrerPolicy="no-referrer"
      className="av-player-tile av-player-avatar"
      onError={() => setBroken(true)}
    />
  );
}

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<SessionStatus>("loading");
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      if (!session?.user) {
        setStatus("out");
        return;
      }
      setStatus("in");
      // Deferido: no llamar a Supabase dentro de este callback (aquí
      // getSession().then, fuera del listener) evita el bloqueo del
      // navigator lock que produce onAuthStateChange más abajo.
      getProfileForUser(session.user).then((p) => {
        if (!cancelled) setProfile(p);
      });
    });

    // No se llama a ninguna función de Supabase directamente dentro
    // de este callback (deadlock conocido del navigator lock); solo
    // se lee el `session` que el propio evento entrega, y el fetch
    // del perfil se difiere a la siguiente vuelta del event loop.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      if (!session?.user) {
        setStatus("out");
        setProfile(null);
        return;
      }
      setStatus("in");
      setTimeout(() => {
        if (cancelled) return;
        getProfileForUser(session.user).then((p) => {
          if (!cancelled) setProfile(p);
        });
      }, 0);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const isActive = (
    section: "home" | "biblioteca" | "salon" | "about" | "auth",
  ) => {
    if (section === "home") return pathname === "/";
    if (section === "biblioteca") return pathname.startsWith("/games");
    if (section === "salon") return pathname === "/hall-of-fame";
    if (section === "about") return pathname === "/about";
    if (section === "auth") return pathname === "/auth";
    return false;
  };

  const close = () => setOpen(false);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setStatus("out");
    setProfile(null);
    router.push("/");
    router.refresh();
  };

  const playerBadge = (
    <div className="av-player-badge">
      <PlayerAvatar
        key={profile?.avatar_url ?? "none"}
        avatarUrl={profile?.avatar_url ?? null}
        initial={(profile?.display_name ?? "P")[0]}
      />
      <span className="av-player-name">{profile?.display_name ?? "···"}</span>
    </div>
  );

  return (
    <>
      <nav className="av-nav">
        <Link href="/" className="logo" onClick={close}>
          <div className="logo-mark" />
          <div className="logo-text neon-cyan">
            ARCADE <span className="neon-magenta">VAULT</span>
          </div>
        </Link>

        <div className="links">
          <Link href="/" className={isActive("home") ? "active" : ""}>
            Inicio
          </Link>
          <Link
            href="/games"
            className={isActive("biblioteca") ? "active" : ""}
          >
            Biblioteca
          </Link>
          <Link
            href="/hall-of-fame"
            className={isActive("salon") ? "active" : ""}
          >
            Salón de la Fama
          </Link>
          <Link href="/about" className={isActive("about") ? "active" : ""}>
            Acerca de
          </Link>
        </div>

        <div className="spacer" />

        <div className="coin-counter">
          <span className="coin" />
          <span>CRÉDITOS · 03</span>
        </div>

        {status === "loading" ? (
          <div className="av-player-badge loading" aria-hidden="true">
            <span className="av-player-tile">···</span>
          </div>
        ) : status === "in" ? (
          <div className="av-player-wrap">
            {playerBadge}
            <button className="btn ghost auth-btn" onClick={handleSignOut}>
              Cerrar sesión
            </button>
          </div>
        ) : (
          <Link href="/auth" className="btn auth-btn">
            Iniciar Sesión
          </Link>
        )}

        <button
          className="btn ghost hamburger"
          onClick={() => setOpen(true)}
          aria-label="Menú"
        >
          ≡
        </button>
      </nav>

      <div
        className={"av-mobile-backdrop" + (open ? " open" : "")}
        onClick={close}
      />
      <aside className={"av-mobile-panel" + (open ? " open" : "")}>
        <div
          className="pixel neon-cyan"
          style={{ fontSize: 11, marginBottom: 16 }}
        >
          MENÚ
        </div>
        <Link
          href="/"
          className={isActive("home") ? "active" : ""}
          onClick={close}
        >
          Inicio
        </Link>
        <Link
          href="/games"
          className={isActive("biblioteca") ? "active" : ""}
          onClick={close}
        >
          Biblioteca
        </Link>
        <Link
          href="/hall-of-fame"
          className={isActive("salon") ? "active" : ""}
          onClick={close}
        >
          Salón de la Fama
        </Link>
        <Link
          href="/about"
          className={isActive("about") ? "active" : ""}
          onClick={close}
        >
          Acerca de
        </Link>
        <Link
          href="/auth"
          className={isActive("auth") ? "active" : ""}
          onClick={close}
        >
          {status === "in" ? "Cuenta" : "Iniciar Sesión"}
        </Link>
        <div style={{ flex: 1 }} />
        {status === "in" && (
          <div className="av-player-wrap av-player-wrap-mobile">
            {playerBadge}
            <button
              className="btn ghost"
              style={{ width: "100%", marginTop: 10 }}
              onClick={() => {
                close();
                handleSignOut();
              }}
            >
              Cerrar sesión
            </button>
          </div>
        )}
        <div
          className="pixel"
          style={{
            fontSize: 9,
            color: "var(--ink-faint)",
            letterSpacing: "0.16em",
          }}
        >
          CRÉDITOS · 03
        </div>
      </aside>
    </>
  );
}
