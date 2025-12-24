import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { Header } from "@/components/layout/header";
import "./globals.css";

const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-sans",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-serif",
});

export const metadata: Metadata = {
  title: "Primal Marc",
  description: "Transform raw ideas into polished prose with AI-powered writing",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={`${inter.variable} ${playfair.variable} font-sans`}>
          <Header />
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}

