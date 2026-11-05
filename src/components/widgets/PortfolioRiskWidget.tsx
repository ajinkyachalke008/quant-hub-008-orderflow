import React, { useState, useEffect } from 'react';
import { RiskEngine } from '../../services/riskEngine';
import { paperTradingEngine } from '../../services/paperTradingEngine';
import { xauusdService } from '../../services/xauusdDataService';
import { RiskProfileSummary } from '../../types/terminal';
import {
  ShieldAlert,
  TrendingDown,
  AlertTriangle,
  Zap,
  Activity,
  BarChart3,
  DollarSign,
  Scale,
} from 'lucide-react';

export const PortfolioRiskWidget: React.FC = () => {
  const [riskProfile, setRiskProfile] = useState<RiskProfileSummary | null>(null);

  useEffect(() => {
    const updateRisk = () => {
      const vault = paperTradingEngine.getActiveVault();
      const positions = vault?.positions || [];
      const equity = vault?.equity || 100000;
      const candles = xauusdService.getCandles();

      const profile = RiskEngine.evaluatePortfolioRisk(positions, equity, candles);
      setRiskProfile(profile);
    };

    updateRisk();

    // Subscribe to position & price updates
    const unsubPaper = paperTradingEngine.subscribe(() => updateRisk());
    const unsubPrice = xauusdService.onPrice(() => updateRisk());

    return () => {
      unsubPaper();
      unsubPrice();
    };
  }, []);

  if (!riskProfile) {
    return (
      <div className="flex items-center justify-center h-full text-xs font-mono text-[var(--text-muted)]">
        Evaluating institutional risk parameters...
      </div>
    );
  }

  const {
    portfolioEquity,
    freeMargin,
    marginUtilizationPct,
    effectiveLeverage,
    dailyParametricVaR95,
    dailyParametricVaR99,
    stressTests,
    liquidationPriceLong,
    liquidationPriceShort,
  } = riskProfile;

  return (
    <div className="flex flex-col h-full bg-[var(--surface-color)] border border-[var(--border-color)] rounded-lg overflow-hidden font-mono text-xs">
      {/* Header */}
      <div className="px-3 py-2 bg-[var(--surface-elevated)] border-b border-[var(--border-color)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-red-400" />
          <span className="font-bold tracking-wider text-[var(--text-color)] uppercase">
            Portfolio Value-at-Risk (VaR) & Stress Testing Suite
          </span>
          <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[10px] font-bold">
            BASEL III / COVARIANCE
          </span>
        </div>

        <div className="flex items-center gap-3 text-[11px] text-[var(--text-muted)]">
          <span>
            Daily Vol: <span className="font-bold text-[var(--text-color)]">{dailyParametricVaR95.portfolioVolatilityPct}%</span>
          </span>
          <span>
            Eff. Leverage: <span className="font-bold text-[var(--accent-cyan)]">{effectiveLeverage}x</span>
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Top KPI Cards: Equity, Margins, Liquidation */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div className="p-2.5 bg-[var(--surface-elevated)] rounded border border-[var(--border-color)] flex flex-col">
            <span className="text-[10px] text-[var(--text-muted)] uppercase">PORTFOLIO EQUITY</span>
            <span className="text-base font-bold text-[var(--text-color)]">${portfolioEquity.toLocaleString()}</span>
            <span className="text-[10px] text-[var(--text-muted)]">Free Margin: ${freeMargin.toLocaleString()}</span>
          </div>

          <div className="p-2.5 bg-[var(--surface-elevated)] rounded border border-[var(--border-color)] flex flex-col">
            <span className="text-[10px] text-[var(--text-muted)] uppercase">MARGIN UTILIZATION</span>
            <div className="flex items-center justify-between mt-0.5">
              <span className={`text-base font-bold ${marginUtilizationPct > 70 ? 'text-red-400' : 'text-[var(--accent-emerald)]'}`}>
                {marginUtilizationPct}%
              </span>
              <Scale className="w-4 h-4 text-[var(--text-muted)]" />
            </div>
            <div className="w-full bg-[var(--border-color)] h-1 rounded mt-1 overflow-hidden">
              <div
                className={`h-full ${marginUtilizationPct > 70 ? 'bg-red-400' : 'bg-[var(--accent-emerald)]'}`}
                style={{ width: `${Math.min(100, marginUtilizationPct)}%` }}
              />
            </div>
          </div>

          <div className="p-2.5 bg-[var(--surface-elevated)] rounded border border-[var(--border-color)] flex flex-col">
            <span className="text-[10px] text-[var(--text-muted)] uppercase">95% 1-DAY VaR</span>
            <span className="text-base font-bold text-amber-400">
              -${dailyParametricVaR95.parametricVaRDollars.toLocaleString()}
            </span>
            <span className="text-[10px] text-[var(--text-muted)]">
              CVaR (Expected Shortfall): -${dailyParametricVaR95.expectedShortfallDollars.toLocaleString()}
            </span>
          </div>

          <div className="p-2.5 bg-[var(--surface-elevated)] rounded border border-[var(--border-color)] flex flex-col">
            <span className="text-[10px] text-[var(--text-muted)] uppercase">EST. LIQUIDATION</span>
            <div className="text-xs font-bold mt-1 space-y-0.5">
              {liquidationPriceLong ? (
                <div className="text-red-400">Long: ${liquidationPriceLong.toFixed(2)}</div>
              ) : null}
              {liquidationPriceShort ? (
                <div className="text-red-400">Short: ${liquidationPriceShort.toFixed(2)}</div>
              ) : null}
              {!liquidationPriceLong && !liquidationPriceShort && (
                <div className="text-[var(--accent-emerald)] font-normal">No Open Risk</div>
              )}
            </div>
          </div>
        </div>

        {/* VaR Detailed Breakdown: Parametric vs Historical Simulation */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-3 bg-[var(--surface-elevated)] rounded border border-[var(--border-color)] flex flex-col gap-2">
            <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-1.5">
              <span className="font-bold text-[var(--accent-amber)] text-xs flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5" />
                95% CONFIDENCE HORIZON (1-DAY)
              </span>
              <span className="text-[10px] text-[var(--text-muted)]">Z-Score: 1.645</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 bg-[var(--surface-color)] rounded border border-[var(--border-color)]">
                <span className="text-[10px] text-[var(--text-muted)] block">Parametric VaR</span>
                <span className="font-bold text-amber-400">-${dailyParametricVaR95.parametricVaRDollars.toFixed(2)}</span>
                <span className="text-[10px] text-[var(--text-muted)] block">({dailyParametricVaR95.parametricVaRPct.toFixed(2)}% equity)</span>
              </div>
              <div className="p-2 bg-[var(--surface-color)] rounded border border-[var(--border-color)]">
                <span className="text-[10px] text-[var(--text-muted)] block">Historical Empirical</span>
                <span className="font-bold text-amber-400">-${dailyParametricVaR95.historicalVaRDollars.toFixed(2)}</span>
                <span className="text-[10px] text-[var(--text-muted)] block">({dailyParametricVaR95.historicalVaRPct.toFixed(2)}% equity)</span>
              </div>
            </div>

            <div className="p-2 bg-[var(--surface-color)] rounded border border-[var(--border-color)] flex justify-between items-center text-xs">
              <span className="text-[var(--text-muted)]">Expected Shortfall (Tail CVaR):</span>
              <span className="font-bold text-red-400">-${dailyParametricVaR95.expectedShortfallDollars.toFixed(2)}</span>
            </div>
          </div>

          <div className="p-3 bg-[var(--surface-elevated)] rounded border border-[var(--border-color)] flex flex-col gap-2">
            <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-1.5">
              <span className="font-bold text-red-400 text-xs flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5" />
                99% CONFIDENCE HORIZON (EXTREME TAIL)
              </span>
              <span className="text-[10px] text-[var(--text-muted)]">Z-Score: 2.326</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 bg-[var(--surface-color)] rounded border border-[var(--border-color)]">
                <span className="text-[10px] text-[var(--text-muted)] block">Parametric 99% VaR</span>
                <span className="font-bold text-red-400">-${dailyParametricVaR99.parametricVaRDollars.toFixed(2)}</span>
                <span className="text-[10px] text-[var(--text-muted)] block">({dailyParametricVaR99.parametricVaRPct.toFixed(2)}% equity)</span>
              </div>
              <div className="p-2 bg-[var(--surface-color)] rounded border border-[var(--border-color)]">
                <span className="text-[10px] text-[var(--text-muted)] block">Historical 99% VaR</span>
                <span className="font-bold text-red-400">-${dailyParametricVaR99.historicalVaRDollars.toFixed(2)}</span>
                <span className="text-[10px] text-[var(--text-muted)] block">({dailyParametricVaR99.historicalVaRPct.toFixed(2)}% equity)</span>
              </div>
            </div>

            <div className="p-2 bg-[var(--surface-color)] rounded border border-[var(--border-color)] flex justify-between items-center text-xs">
              <span className="text-[var(--text-muted)]">99% Tail Risk (CVaR):</span>
              <span className="font-bold text-red-400">-${dailyParametricVaR99.expectedShortfallDollars.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Macroeconomic Stress Testing Scenarios Table */}
        <div className="bg-[var(--surface-elevated)] rounded border border-[var(--border-color)] p-3">
          <div className="flex items-center justify-between pb-2 border-b border-[var(--border-color)] mb-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span className="font-bold text-xs text-[var(--text-color)]">
                INSTITUTIONAL MACRO STRESS TESTING SCENARIOS
              </span>
            </div>
            <span className="text-[10px] text-[var(--text-muted)]">
              Simulates portfolio equity, margin breach & liquidation risks
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-[10px] text-[var(--text-muted)] uppercase border-b border-[var(--border-color)]">
                  <th className="pb-1.5 font-normal">Scenario Name</th>
                  <th className="pb-1.5 font-normal">Shock Drivers</th>
                  <th className="pb-1.5 font-normal">Spread Multiplier</th>
                  <th className="pb-1.5 font-normal">Projected PnL</th>
                  <th className="pb-1.5 font-normal">Post-Shock Margin</th>
                  <th className="pb-1.5 font-normal text-right">Margin Call Risk</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)] font-mono">
                {stressTests.map((st) => (
                  <tr key={st.id} className="hover:bg-[var(--surface-color)] transition-colors">
                    <td className="py-2 pr-2">
                      <span className="font-bold text-[var(--text-color)] block">{st.name}</span>
                      <span className="text-[10px] text-[var(--text-muted)] line-clamp-1">{st.description}</span>
                    </td>
                    <td className="py-2 pr-2">
                      <span className={st.goldShockPct >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                        Gold {st.goldShockPct >= 0 ? '+' : ''}{st.goldShockPct}%
                      </span>
                    </td>
                    <td className="py-2 pr-2 text-[var(--text-muted)]">
                      {st.spreadMultiplier}x
                    </td>
                    <td className="py-2 pr-2 font-bold">
                      <span className={st.projectedPortfolioPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                        {st.projectedPortfolioPnL >= 0 ? '+' : ''}${st.projectedPortfolioPnL.toLocaleString()} ({st.projectedPortfolioPnLPct}%)
                      </span>
                    </td>
                    <td className="py-2 pr-2">
                      <span className={st.postShockMarginRatio > 100 ? 'text-red-400 font-bold' : 'text-[var(--text-color)]'}>
                        {st.postShockMarginRatio}%
                      </span>
                    </td>
                    <td className="py-2 text-right">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          st.marginCallRisk === 'CRITICAL'
                            ? 'bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse'
                            : st.marginCallRisk === 'ELEVATED'
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                            : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        }`}
                      >
                        {st.marginCallRisk}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
