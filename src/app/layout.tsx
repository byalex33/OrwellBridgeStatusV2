import type { Metadata, Viewport } from "next";
import { cookies, headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import StructuredData from "@/components/StructuredData";
import TracwellAnalytics from "@/components/TracwellAnalytics";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_TITLE = "Is the Orwell Bridge Open? Live A14 Status & Wind Closures";
const SITE_DESCRIPTION = "Live A14 Orwell Bridge status both ways: open, delayed or closed. Forecast wind warnings (40 mph limit over 50 mph, closure at 60 mph+) and closure alerts.";
const SOCIAL_DESCRIPTION = "Live A14 Orwell Bridge status both ways, high-wind warnings and closure alerts.";

export const metadata: Metadata = {
  metadataBase: new URL('https://www.orwellbridgestatus.com'),
  title: {
    default: SITE_TITLE,
    template: "%s | Orwell Bridge Status"
  },
  description: SITE_DESCRIPTION,
  applicationName: "Orwell Bridge Status",
  keywords: [
    "Orwell Bridge",
    "Orwell Bridge status",
    "Orwell Bridge closed",
    "Orwell Bridge wind",
    "A14 Orwell Bridge",
    "A14 Ipswich traffic",
    "Orwell Bridge closure alerts"
  ],
  authors: [{ name: "Alex", url: "https://github.com/developedbyalex" }],
  creator: "Alex",
  publisher: "Orwell Bridge Status",
  category: "Transportation",
  classification: "Traffic Monitoring",
  referrer: "origin-when-cross-origin",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  // Share images come from src/app/opengraph-image.tsx and twitter-image.tsx.
  openGraph: {
    type: "website",
    locale: "en_GB",
    url: "/",
    siteName: "Orwell Bridge Status",
    title: SITE_TITLE,
    description: SOCIAL_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SOCIAL_DESCRIPTION,
  },
  alternates: {
    canonical: "/",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/icon-192.png",
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "default",
    "apple-mobile-web-app-title": "Orwell Bridge",
    "mobile-web-app-capable": "yes",
    "msapplication-TileColor": "#000000",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#182b46",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const theme = (await cookies()).get("theme")?.value === "light" ? "light" : "dark";
  return (
    <html lang="en-GB" className={theme}>
      <head>
        <StructuredData nonce={nonce} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <Analytics />
        <TracwellAnalytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
