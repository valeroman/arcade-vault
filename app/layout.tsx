import type { Metadata } from "next";
import { Press_Start_2P, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

const pressStart2P = Press_Start_2P({
  weight: "400",
  variable: "--font-pixel",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Arcade Vault",
  description: "Online gaming platform where players compete for points",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${pressStart2P.variable} ${jetbrainsMono.variable}`}
    >
      <body>
        <div className="av-bg" />
        <div className="av-noise" />
        <Nav />
        <main className="av-main">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
