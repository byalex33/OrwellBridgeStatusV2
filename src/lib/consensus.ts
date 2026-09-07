import type { TrafficData } from './traffic';

// Adapters must validate freshness and explicit closure evidence before voting.
export function consensusDirection(...sources: Array<TrafficData | null>): TrafficData {
  const known = sources.filter((source): source is TrafficData => !!source && source.status !== 'UNKNOWN');
  const selected = known.find(source => source.status === 'CLOSED')
    ?? known.find(source => source.status === 'DELAYED') ?? known[0];
  if (!selected) return { status: 'UNKNOWN', details: 'No current traffic sources available', averageSpeed: 0, description: 'Orwell Bridge' };
  const disagreement = selected.status === 'CLOSED' && known.some(source => source.status !== 'CLOSED');
  return {
    ...selected,
    details: `${selected.details}${disagreement ? '. Sources disagree: a closure is reported despite other traffic estimates; verify official information' : ''}. Sources: ${known.map(source => source.description).join('; ')}`,
  };
}
