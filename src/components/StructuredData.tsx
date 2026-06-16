export default function StructuredData() {
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": "https://orwellbridgestatus.vercel.app/#website",
        "url": "https://orwellbridgestatus.vercel.app/",
        "name": "Orwell Bridge Status",
        "description": "Real-time monitoring of Orwell Bridge (A14) traffic conditions, weather alerts, lane closures and delays"
      },
      {
        "@type": "WebApplication",
        "@id": "https://orwellbridgestatus.vercel.app/#webapp",
        "url": "https://orwellbridgestatus.vercel.app/",
        "name": "Orwell Bridge Status Monitor",
        "description": "Live traffic monitoring system for the Orwell Bridge on the A14 in Suffolk",
        "applicationCategory": "TransportationApplication",
        "operatingSystem": "Web Browser",
        "offers": {
          "@type": "Offer",
          "price": "0",
          "priceCurrency": "GBP"
        },
        "featureList": [
          "Real-time traffic status",
          "Weather monitoring",
          "Historical events tracking",
          "Direction-specific data",
          "Mobile responsive design"
        ]
      },
      {
        "@type": "Place",
        "@id": "https://orwellbridgestatus.vercel.app/#place",
        "name": "Orwell Bridge",
        "description": "Cable-stayed bridge carrying the A14 over the River Orwell in Suffolk, England",
        "geo": {
          "@type": "GeoCoordinates",
          "latitude": 52.045,
          "longitude": 1.172
        },
        "address": {
          "@type": "PostalAddress",
          "addressLocality": "Ipswich",
          "addressRegion": "Suffolk",
          "addressCountry": "GB"
        },
        "containedInPlace": {
          "@type": "Place",
          "name": "Suffolk, England"
        }
      },
      {
        "@type": "Organization",
        "@id": "https://orwellbridgestatus.vercel.app/#organization",
        "name": "Orwell Bridge Status",
        "url": "https://orwellbridgestatus.vercel.app/",
        "logo": {
          "@type": "ImageObject",
          "url": "https://orwellbridgestatus.vercel.app/logo.svg"
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
        "@id": "https://orwellbridgestatus.vercel.app/#service",
        "name": "Bridge Traffic Monitoring",
        "description": "Real-time monitoring service for Orwell Bridge traffic conditions",
        "provider": {
          "@id": "https://orwellbridgestatus.vercel.app/#organization"
        },
        "areaServed": {
          "@type": "Place",
          "name": "Suffolk, England"
        },
        "serviceType": "Traffic Information Service",
        "audience": {
          "@type": "Audience",
          "audienceType": ["Commuters", "Logistics Companies", "Local Residents"]
        }
      }
    ]
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  );
}