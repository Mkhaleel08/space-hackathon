import type { Metadata } from "next";
import { Barlow, Barlow_Semi_Condensed, Geist_Mono } from "next/font/google";
import "./globals.css";

// Barlow is DIN-derived, the face of signage and machine nameplates. The
// semi-condensed cut carries the part name and the next step; the regular
// width carries everything else. Geist Mono stays for measured values only.
const barlow = Barlow({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const barlowDisplay = Barlow_Semi_Condensed({
  variable: "--font-barlow-display",
  subsets: ["latin"],
  weight: ["500", "600"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Machine Memory",
  description: "Point your camera at a part. See what the machine remembers.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${barlow.variable} ${barlowDisplay.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">{children}</body>
    </html>
  );
}
