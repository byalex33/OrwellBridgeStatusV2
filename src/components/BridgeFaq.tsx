import { ChevronDown, ExternalLink } from "lucide-react";
import { bridgeFaq } from "@/components/bridgeFaqContent";

// No hooks or browser APIs: safe to render from server or client components.
// The FAQPage JSON-LD in StructuredData.tsx is built from the same content.
export default function BridgeFaq() {
  return (
    <section aria-labelledby="bridge-faq-title">
      <h2 id="bridge-faq-title" className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-3">
        Orwell Bridge questions
      </h2>
      <div className="space-y-2">
        {bridgeFaq.map(({ question, answer, link }) => (
          <details key={question} className="group rounded-xl border border-border/50 bg-card">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring rounded-xl">
              {question}
              <ChevronDown aria-hidden="true" className="h-4 w-4 flex-shrink-0 text-muted-foreground motion-safe:transition-transform group-open:rotate-180" />
            </summary>
            <div className="space-y-2 px-4 pb-4 text-sm leading-relaxed text-muted-foreground">
              {answer.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
              {link && (
                <p>
                  <a href={link.href} className="inline-flex items-center gap-1 underline hover:text-foreground">
                    {link.label}
                    <ExternalLink aria-hidden="true" className="h-3 w-3" />
                  </a>
                </p>
              )}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
