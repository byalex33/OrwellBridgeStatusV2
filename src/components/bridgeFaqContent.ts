// Shared by the visible FAQ (BridgeFaq.tsx) and the FAQPage JSON-LD (StructuredData.tsx)
// so the structured data always matches what visitors can read. Plain text only.

export const NATIONAL_HIGHWAYS_ORWELL_URL = "https://nationalhighways.co.uk/travel-updates/the-orwell-bridge";

export interface BridgeFaqItem {
  question: string;
  answer: string[];
  link?: { href: string; label: string };
}

export const bridgeFaq: BridgeFaqItem[] = [
  {
    question: "Is the Orwell Bridge open right now?",
    answer: [
      "The Current Status panel at the top of this page shows whether the A14 across the bridge is open, delayed or closed in each direction: eastbound towards Felixstowe and westbound towards Ipswich. It also shows when the reading was taken.",
      "If the status is marked stale or unavailable, or strong winds are forecast, check National Highways before you set off.",
    ],
    link: { href: NATIONAL_HIGHWAYS_ORWELL_URL, label: "National Highways: Orwell Bridge updates" },
  },
  {
    question: "Why does the Orwell Bridge close?",
    answer: [
      "Mostly because of high winds. The deck is high above the estuary and exposed to side winds, which are dangerous for high-sided vehicles.",
      "The normal limit on the bridge is 60 mph. National Highways brings in a 40 mph limit when winds over 50 mph are forecast, and closes the bridge when winds of 60 mph or more are predicted.",
      "It can also close for collisions, breakdowns and planned maintenance, which is usually done overnight.",
    ],
  },
  {
    question: "What is the diversion when the Orwell Bridge is closed?",
    answer: [
      "A14 traffic is diverted between junction 55 (Copdock) and junction 58 (Seven Hills). For full closures the signed route usually runs through Ipswich on the A1214, A1189 and A1156, and the same in reverse for westbound traffic. Some overnight roadwork closures use the A12 and A1214 instead.",
      "Follow the signed diversion on the day, and expect heavy traffic across Ipswich while the bridge is shut.",
    ],
  },
  {
    question: "How long and how high is the Orwell Bridge?",
    answer: [
      "The bridge is 1,287 metres (4,222 ft) long and carries the A14 over the River Orwell just south of Ipswich. Its central span gives about 43 metres (141 ft) of clearance above the river, so ships can reach the Port of Ipswich.",
      "It is a prestressed concrete box girder bridge. Its 190 metre main span was the longest prestressed concrete span in the UK when it opened in 1982.",
    ],
  },
  {
    question: "How can I get an alert when the bridge closes?",
    answer: [
      "Turn on closure alerts on this page to get a push notification when a new closure is detected. On iPhone or iPad, add this site to your Home Screen from Safari first, then turn on alerts from the new icon.",
      "Alerts can arrive late or be missed, so check conditions before travelling.",
    ],
  },
  {
    question: "Is this an official National Highways website?",
    answer: [
      "No. Orwell Bridge Status is an independent, unofficial site. It is not run by or connected to National Highways. The status comes from third-party traffic data and weather forecasts, so it can be late or wrong.",
      "For official closure notices, use National Highways.",
    ],
    link: { href: NATIONAL_HIGHWAYS_ORWELL_URL, label: "Official Orwell Bridge information" },
  },
];
