import { bridgeFaq } from "@/components/bridgeFaqContent";

const SITE_URL = "https://www.orwellbridgestatus.com/";

export default function StructuredData({ nonce }: { nonce?: string }) {
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}#website`,
        "url": SITE_URL,
        "name": "Orwell Bridge Status",
        "alternateName": "orwellbridgestatus.com",
        "description": "Independent, unofficial live status for the A14 Orwell Bridge near Ipswich: open, delayed or closed in each direction, high-wind warnings and closure alerts.",
        "inLanguage": "en-GB",
        "publisher": { "@id": `${SITE_URL}#organization` }
      },
      {
        "@type": "WebPage",
        "@id": `${SITE_URL}#webpage`,
        "url": SITE_URL,
        "name": "Is the Orwell Bridge Open? Live A14 Status & Wind Closures",
        "isPartOf": { "@id": `${SITE_URL}#website` },
        "about": { "@id": `${SITE_URL}#bridge` },
        "inLanguage": "en-GB"
      },
      {
        "@type": "WebApplication",
        "@id": `${SITE_URL}#webapp`,
        "url": SITE_URL,
        "name": "Orwell Bridge Status",
        "description": "Independent web app showing live A14 Orwell Bridge traffic status in both directions, forecast high-wind warnings and closure push alerts.",
        "applicationCategory": "TravelApplication",
        "operatingSystem": "Any (web browser)",
        "offers": {
          "@type": "Offer",
          "price": "0",
          "priceCurrency": "GBP"
        },
        "featureList": [
          "Live open, delayed or closed status for eastbound and westbound A14 traffic",
          "Forecast high-wind warnings for the bridge",
          "Closure push notifications",
          "Recent closure and delay history"
        ]
      },
      {
        "@type": "Bridge",
        "@id": `${SITE_URL}#bridge`,
        "name": "Orwell Bridge",
        "description": "Prestressed concrete box girder bridge carrying the A14 over the River Orwell south of Ipswich, Suffolk. Opened in 1982; 1,287 m long with a 190 m main span.",
        "geo": {
          "@type": "GeoCoordinates",
          "latitude": 52.0269,
          "longitude": 1.1645
        },
        "address": {
          "@type": "PostalAddress",
          "addressLocality": "Ipswich",
          "addressRegion": "Suffolk",
          "addressCountry": "GB"
        },
        "containedInPlace": {
          "@type": "AdministrativeArea",
          "name": "Suffolk, England"
        },
        "sameAs": ["https://en.wikipedia.org/wiki/Orwell_Bridge"]
      },
      {
        "@type": "Organization",
        "@id": `${SITE_URL}#organization`,
        "name": "Orwell Bridge Status",
        "description": "Independent, unofficial website. Not affiliated with National Highways.",
        "url": SITE_URL,
        "logo": {
          "@type": "ImageObject",
          "url": `${SITE_URL}logo.svg`
        },
        "sameAs": [
          "https://github.com/developedbyalex/OrwellBridgeStatusV2"
        ],
        "founder": {
          "@type": "Person",
          "name": "Alex"
        }
      },
      {
        "@type": "Service",
        "@id": `${SITE_URL}#service`,
        "name": "Orwell Bridge status monitoring",
        "description": "Unofficial monitoring of A14 Orwell Bridge traffic and wind conditions",
        "provider": {
          "@id": `${SITE_URL}#organization`
        },
        "areaServed": {
          "@type": "AdministrativeArea",
          "name": "Suffolk, England"
        },
        "serviceType": "Traffic Information Service",
        "audience": {
          "@type": "Audience",
          "audienceType": "Commuters, hauliers and local residents"
        }
      },
      {
        "@type": "FAQPage",
        "@id": `${SITE_URL}#faq`,
        "isPartOf": { "@id": `${SITE_URL}#webpage` },
        "mainEntity": bridgeFaq.map(({ question, answer }) => ({
          "@type": "Question",
          "name": question,
          "acceptedAnswer": {
            "@type": "Answer",
            "text": answer.join(" ")
          }
        }))
      }
    ]
  };

  return (
    <script
      type="application/ld+json"
      nonce={nonce}
      // Browsers hide the nonce attribute before hydration to prevent its extraction.
      suppressHydrationWarning
      // Escape "<" so content can never close the script element early.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
    />
  );
}
