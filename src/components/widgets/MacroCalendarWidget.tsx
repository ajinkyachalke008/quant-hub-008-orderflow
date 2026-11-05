import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  AlertTriangle,
  Flame,
  TrendingUp,
  TrendingDown,
  Gauge,
  Tag,
  CheckCircle,
} from 'lucide-react';
import { macroCalendarService } from '../../services/macroCalendarService';
import { EconomicEvent, NewsSentimentReport } from '../../types/terminal';

export const MacroCalendarWidget: React.FC = () => {
  const [events, setEvents] = useState<EconomicEvent[]>(() => macroCalendarService.getEvents());
  const [sentiment, setSentiment] = useState<NewsSentimentReport>(() => macroCalendarService.getSentiment());

  useEffect(() => {
    const timer = setInterval(() => {
      setEvents(macroCalendarService.getEvents());
      setSentiment(macroCalendarService.getSentiment());
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  const formatCountdown = (mins?: number) => {
    if (mins === undefined) return 'N/A';
    if (mins === 0) return 'RELEASED';
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${m}m`;
  };

  const isBullish = sentiment.sentimentLabel === 'BULLISH';
  const isBearish = sentiment.sentimentLabel === 'BEARISH';

  return (
    <div className="flex flex-col h-full bg-[var(--surface-color)] text-[var(--text-color)] text-xs font-mono select-none overflow-hidden">
      {/* Header */}
      <div className="p-2.5 bg-[var(--surface-elevated)] border-b border-[var(--border-color)] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-[var(--accent-amber)]" />
          <span className="font-bold uppercase tracking-wider text-sm text-[var(--accent-amber)]">
            Economic Calendar & News Sentiment
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--border-color)] text-[var(--text-muted)]">
            Institutional Macro Wire
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[var(--text-muted)]">NLP SENTIMENT:</span>
          <span
            className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
              isBullish
                ? 'bg-[var(--accent-emerald)]/20 text-[var(--accent-emerald)] border border-[var(--accent-emerald)]/40'
                : isBearish
                ? 'bg-[#FF5252]/20 text-[#FF5252] border border-[#FF5252]/40'
                : 'bg-[var(--border-color)] text-[var(--text-muted)]'
            }`}
          >
            {sentiment.sentimentLabel} ({sentiment.netSentiment >= 0 ? '+' : ''}
            {(sentiment.netSentiment * 100).toFixed(0)}%)
          </span>
        </div>
      </div>

      {/* Main Split: Calendar Events Table + NLP Sentiment Gauge */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-3 p-3 overflow-hidden min-h-0">
        {/* Left 8 cols: Economic Calendar Releases */}
        <div className="md:col-span-8 flex flex-col bg-[var(--surface-elevated)] border border-[var(--border-color)] rounded p-2.5 overflow-hidden">
          <div className="flex items-center justify-between mb-1 pb-1 border-b border-[var(--border-color)] text-[10px] uppercase font-bold text-[var(--text-muted)]">
            <span>High-Impact Releases ({events.length})</span>
            <span>Forecast / Previous</span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 font-mono text-[11px]">
            {events.map((evt) => {
              const isUrgent = (evt.countdownMinutes || 999) <= 60;
              return (
                <div
                  key={evt.id}
                  className={`p-2 rounded border transition-all ${
                    isUrgent
                      ? 'bg-[var(--accent-amber)]/10 border-[var(--accent-amber)]/50'
                      : 'bg-[var(--surface-color)] border-[var(--border-color)]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[8px] font-bold px-1 py-0.2 rounded uppercase ${
                          evt.impact === 'HIGH'
                            ? 'bg-[#FF1744] text-white'
                            : evt.impact === 'MEDIUM'
                            ? 'bg-[var(--accent-amber)] text-black'
                            : 'bg-blue-400 text-black'
                        }`}
                      >
                        {evt.impact}
                      </span>
                      <span className="font-bold text-[9px] px-1 py-0.2 rounded bg-[var(--surface-elevated)] text-[var(--accent-cyan)]">
                        {evt.currency}
                      </span>
                      <strong className="text-xs text-[var(--text-color)]">{evt.title}</strong>
                    </div>

                    <div className="flex items-center gap-1 font-bold">
                      <Clock className="w-3 h-3 text-[var(--accent-amber)]" />
                      <span className={isUrgent ? 'text-[var(--accent-amber)] animate-pulse' : 'text-[var(--text-muted)]'}>
                        {formatCountdown(evt.countdownMinutes)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)] pl-1">
                    <span>Date: {new Date(evt.dateUtc).toUTCString().slice(0, 22)} UTC</span>
                    <div className="flex items-center gap-2 font-mono">
                      <span>Forecast: <strong className="text-white">{evt.forecast || 'N/A'}</strong></span>
                      <span>Prev: <strong className="text-slate-400">{evt.previous || 'N/A'}</strong></span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right 4 cols: NLP News Sentiment Gauge & Lexicon Weighting */}
        <div className="md:col-span-4 flex flex-col bg-[var(--surface-elevated)] border border-[var(--border-color)] rounded p-2.5 overflow-y-auto space-y-3">
          <div className="pb-1 border-b border-[var(--border-color)] flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-[var(--accent-cyan)] tracking-wider">
              Bullion NLP Sentiment Meter
            </span>
            <span className="text-[9px] text-[var(--text-muted)]">{sentiment.sampleCount} wire sources</span>
          </div>

          {/* Sentiment Meter Bar */}
          <div className="space-y-1.5 p-2.5 rounded bg-[var(--surface-color)] border border-[var(--border-color)]">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-[var(--accent-emerald)] flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5" /> {sentiment.bullishScore}% Bullish
              </span>
              <span className="text-[#FF5252] flex items-center gap-1">
                {sentiment.bearishScore}% Bearish <TrendingDown className="w-3.5 h-3.5" />
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-full h-2 rounded-full bg-[var(--surface-elevated)] overflow-hidden flex border border-[var(--border-color)]">
              <div
                className="bg-[var(--accent-emerald)] h-full transition-all duration-300"
                style={{ width: `${sentiment.bullishScore}%` }}
              />
              <div
                className="bg-[#FF5252] h-full transition-all duration-300"
                style={{ width: `${sentiment.bearishScore}%` }}
              />
            </div>

            <div className="text-[10px] text-center text-[var(--text-muted)] pt-0.5">
              Net Bias: <strong className={isBullish ? 'text-[var(--accent-emerald)]' : isBearish ? 'text-[#FF5252]' : 'text-slate-400'}>
                {sentiment.sentimentLabel} ({sentiment.netSentiment >= 0 ? '+' : ''}{(sentiment.netSentiment * 100).toFixed(0)}%)
              </strong>
            </div>
          </div>

          {/* Top Sentiment Driving Lexicon Keywords */}
          <div className="space-y-1.5">
            <span className="text-[9px] uppercase font-bold text-[var(--text-muted)] tracking-wider block">
              Dominant Lexicon Drivers
            </span>

            <div className="space-y-1">
              {sentiment.topKeywords.map((kw, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-1.5 rounded bg-[var(--surface-color)] border border-[var(--border-color)] text-[10px]"
                >
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        kw.sentiment === 'bullish' ? 'bg-[var(--accent-emerald)]' : 'bg-[#FF5252]'
                      }`}
                    />
                    <span className="text-[var(--text-color)] font-medium">{kw.word}</span>
                  </div>
                  <span className="font-bold text-[var(--accent-amber)]">{kw.count} hits</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
