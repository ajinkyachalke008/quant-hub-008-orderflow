import React, { useState } from 'react';
import { ChartWidget } from './ChartWidget';
import { MtfLayoutMode } from '../../types/terminal';
import { LayoutGrid, Columns, Square } from 'lucide-react';

export const MtfWorkspaceGrid: React.FC = () => {
  const [mtfMode, setMtfMode] = useState<MtfLayoutMode>('1x2'); // Default confirmed 1x2 dual-pane
  const [sharedHoverIndex, setSharedHoverIndex] = useState<number | null>(null);

  return (
    <div className="flex flex-col h-full space-y-2">
      {/* MTF Mode Selector Bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-md text-xs font-mono">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
            MULTI-TIMEFRAME (MTF) SYNCHRONIZED SUITE:
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setMtfMode('1x1')}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] transition-colors ${
                mtfMode === '1x1'
                  ? 'bg-[var(--accent)] text-black font-semibold'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--surface-elevated)]'
              }`}
            >
              <Square className="w-3 h-3" />
              <span>1x1 SINGLE</span>
            </button>
            <button
              onClick={() => setMtfMode('1x2')}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] transition-colors ${
                mtfMode === '1x2'
                  ? 'bg-[var(--accent)] text-black font-semibold'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--surface-elevated)]'
              }`}
            >
              <Columns className="w-3 h-3" />
              <span>1x2 DUAL (DEFAULT)</span>
            </button>
            <button
              onClick={() => setMtfMode('2x2')}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] transition-colors ${
                mtfMode === '2x2'
                  ? 'bg-[var(--accent)] text-black font-semibold'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--surface-elevated)]'
              }`}
            >
              <LayoutGrid className="w-3 h-3" />
              <span>2x2 QUAD</span>
            </button>
          </div>
        </div>

        <span className="hidden sm:inline text-[10px] text-[var(--accent)]">
          ● SYNCHRONIZED CROSSHAIRS ACTIVE
        </span>
      </div>

      {/* Grid Container */}
      <div className="flex-1 min-h-[480px]">
        {mtfMode === '1x1' && (
          <div className="h-full">
            <ChartWidget
              customTimeframe="15m"
              paneTitle="15M EXECUTION"
              syncHoverIndex={sharedHoverIndex}
              onHoverChange={setSharedHoverIndex}
            />
          </div>
        )}

        {mtfMode === '1x2' && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 h-full">
            <div className="h-[480px] xl:h-full">
              <ChartWidget
                customTimeframe="15m"
                paneTitle="15M TACTICAL INTRADAY"
                syncHoverIndex={sharedHoverIndex}
                onHoverChange={setSharedHoverIndex}
              />
            </div>
            <div className="h-[480px] xl:h-full">
              <ChartWidget
                customTimeframe="1h"
                paneTitle="1H MACRO STRUCTURE"
                syncHoverIndex={sharedHoverIndex}
                onHoverChange={setSharedHoverIndex}
              />
            </div>
          </div>
        )}

        {mtfMode === '2x2' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 h-full">
            <div className="h-[360px]">
              <ChartWidget
                customTimeframe="1m"
                paneTitle="1M ORDER FLOW"
                syncHoverIndex={sharedHoverIndex}
                onHoverChange={setSharedHoverIndex}
              />
            </div>
            <div className="h-[360px]">
              <ChartWidget
                customTimeframe="15m"
                paneTitle="15M STRUCTURE"
                syncHoverIndex={sharedHoverIndex}
                onHoverChange={setSharedHoverIndex}
              />
            </div>
            <div className="h-[360px]">
              <ChartWidget
                customTimeframe="1h"
                paneTitle="1H TREND"
                syncHoverIndex={sharedHoverIndex}
                onHoverChange={setSharedHoverIndex}
              />
            </div>
            <div className="h-[360px]">
              <ChartWidget
                customTimeframe="4h"
                paneTitle="4H INSTITUTIONAL"
                syncHoverIndex={sharedHoverIndex}
                onHoverChange={setSharedHoverIndex}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
