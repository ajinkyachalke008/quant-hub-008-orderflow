import { useOrderFlowStore } from '../../stores/orderFlowStore';
import { FeedState } from '../../types/orderFlow';

const COLOR: Record<FeedState, string> = {
  LIVE: 'var(--ot-profit)',
  CONNECTING: 'var(--ot-amber)',
  RECONNECTING: 'var(--ot-amber)',
  DELAYED: 'var(--ot-amber)',
  STALE: 'var(--ot-text-muted)',
  DISCONNECTED: 'var(--ot-loss)',
  ERROR: 'var(--ot-loss)',
  UNSUPPORTED: 'var(--ot-text-muted)',
};

export function FeedStatusBadge({ feed }: { feed: string }) {
  const state = useOrderFlowStore((s) => s.feedStates[feed] ?? 'CONNECTING');
  const color = COLOR[state as FeedState] ?? 'var(--ot-text-muted)';
  return (
    <span title={feed} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--ot-text-secondary)', fontSize: 11 }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, animation: state === 'RECONNECTING' ? 'pulse 1s infinite' : 'none' }} />
      {state}
    </span>
  );
}

export default FeedStatusBadge;
