import type { Metadata } from "next";
import { Inter, Sora } from "next/font/google";
import { Providers } from "../providers";
import { MiniPlayer } from "@/components/MiniPlayer";
import "../styles/globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
});

export const metadata: Metadata = {
  title: "MindScript - Program your inner voice",
  description: "Create personalized affirmation loops with studio-quality voice and binaural sound.",
  keywords: ["affirmations", "meditation", "binaural beats", "solfeggio frequencies", "mindfulness"],
  authors: [{ name: "MindScript" }],
  openGraph: {
    title: "MindScript - Program your inner voice",
    description: "Create personalized affirmation loops with studio-quality voice and binaural sound.",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "MindScript - Program your inner voice",
    description: "Create personalized affirmation loops with studio-quality voice and binaural sound.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${sora.variable}`}>
      <body className="min-h-screen bg-background font-sans antialiased">
        <Providers>
          {children}
          <MiniPlayer />
        </Providers>
      </body>
    </html>
  );
}
