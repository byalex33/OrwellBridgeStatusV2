import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import StructuredData from "@/components/StructuredData";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://www.orwellbridgestatus.com'),
  title: {
    default: "Orwell Bridge Status - Live A14 Traffic Monitor",
    template: "%s | Orwell Bridge Status"
  },
  description: "Real-time monitoring of Orwell Bridge (A14) traffic conditions, weather alerts, lane closures and delays. Essential for Suffolk commuters and logistics companies.",
  keywords: [
    "Orwell Bridge",
    "A14 traffic",
    "bridge status",
    "Suffolk traffic",
    "Ipswich traffic",
    "bridge closures",
    "wind alerts",
    "traffic delays",
    "real-time traffic",
    "bridge monitoring",
    "weather conditions",
    "Felixstowe traffic"
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
  openGraph: {
    type: "website",
    locale: "en_GB",
    url: "https://www.orwellbridgestatus.com",
    siteName: "Orwell Bridge Status",
    title: "Orwell Bridge Status - Live A14 Traffic Monitor",
    description: "Real-time monitoring of Orwell Bridge (A14) traffic conditions, weather alerts, lane closures and delays. Essential for Suffolk commuters.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Orwell Bridge Status Dashboard",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Orwell Bridge Status - Live A14 Traffic Monitor",
    description: "Real-time monitoring of Orwell Bridge traffic conditions and weather alerts",
    images: ["/og-image.png"],
    creator: "@OrwellBridgeStatus",
  },
  alternates: {
    canonical: "https://www.orwellbridgestatus.com",
  },
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
    "apple-mobile-web-app-title": "Orwell Bridge",
    "mobile-web-app-capable": "yes",
    "msapplication-TileColor": "#000000",
    "theme-color": "#000000",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#000000",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="en" className="dark">
      <head>
        <StructuredData nonce={nonce} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
