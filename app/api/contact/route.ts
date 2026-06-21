import { NextResponse } from "next/server";
import { Resend } from "resend";

type ContactPayload = {
  name: string;
  email: string;
  msg: string;
};

export async function POST(request: Request) {
  const body: ContactPayload = await request.json();
  const { name, email, msg } = body;

  if (!name?.trim() || !email?.trim() || !msg?.trim()) {
    return NextResponse.json({ error: "Todos los campos son obligatorios." }, { status: 400 });
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: "Configuración de email no disponible." }, { status: 500 });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  try {
    await resend.emails.send({
      from: "onboarding@resend.dev",
      to: "valeroman@gmail.com",
      subject: `Nuevo mensaje de ${name} — Arcade Vault`,
      html: `<p><strong>Nombre:</strong> ${name}</p><p><strong>Email:</strong> ${email}</p><p><strong>Mensaje:</strong><br/>${msg}</p>`,
    });

    await resend.emails.send({
      from: "onboarding@resend.dev",
      to: email,
      subject: "Hemos recibido tu mensaje — Arcade Vault",
      html: `<p>Hola ${name},</p><p>Hemos recibido tu mensaje y te responderemos pronto.</p><p>— Equipo Arcade Vault</p>`,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al enviar el email.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
