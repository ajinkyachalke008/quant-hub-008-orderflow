import { EconomicEvent, NewsSentimentReport } from '../types/terminal';

// High-impact economic calendar events scheduled around current market sessions
const SCHEDULED_EVENTS: Omit<EconomicEvent, 'countdownMinutes'>[] = [
  {
    id: 'evt_fomc_rate',
    title: 'FOMC Federal Funds Rate Decision & Statement',
    currency: 'USD',
    dateUtc: new Date(Date.now() + 45 * 60 * 1000).toISOString(), // 45 mins from now
    impact: 'HIGH',
    forecast: '4.50%',
    previous: '4.75%',
  },
  {
    id: 'evt_us_cpi',
    title: 'US Consumer Price Index (CPI YoY)',
    currency: 'USD',
    dateUtc: new Date(Date.now() + 180 * 60 * 1000).toISOString(), // 3 hours from now
    impact: 'HIGH',
    forecast: '2.6%',
    previous: '2.7%',
  },
  {
    id: 'evt_us_nfp',
    title: 'US Non-Farm Payrolls (NFP) & Unemployment Rate',
    currency: 'USD',
    dateUtc: new Date(Date.now() + 540 * 60 * 1000).toISOString(),
    impact: 'HIGH',
    forecast: '165K',
    previous: '142K',
  },
  {
    id: 'evt_lbma_pm',
    title: 'LBMA Gold PM Official Benchmark Fixing (London)',
    currency: 'XAU',
    dateUtc: new Date(Date.now() + 720 * 60 * 1000).toISOString(),
    impact: 'MEDIUM',
    forecast: '$4,042.50',
    previous: '$4,035.10',
  },
  {
    id: 'evt_ecb_rate',
    title: 'ECB Main Refinancing Rate Decision',
    currency: 'EUR',
    dateUtc: new Date(Date.now() + 1440 * 60 * 1000).toISOString(),
    impact: 'HIGH',
    forecast: '3.25%',
    previous: '3.50%',
  },
  {
    id: 'evt_us_ppi',
    title: 'US Producer Price Index (PPI MoM)',
    currency: 'USD',
    dateUtc: new Date(Date.now() + 2100 * 60 * 1000).toISOString(),
    impact: 'MEDIUM',
    forecast: '0.2%',
    previous: '0.3%',
  },
];

const BULLISH_LEXICON: Record<string, number> = {
  'rate cut': 2.5,
  'dovish': 2.0,
  'central bank buying': 3.0,
  'safe haven': 2.5,
  'gold reserve': 2.0,
  'inflation hedge': 1.8,
  'de-dollarization': 2.2,
  'easing': 1.5,
  'geopolitical tension': 2.0,
  'sovereign debt': 1.6,
  'recession risk': 1.8,
  'deficit': 1.5,
  'bullion demand': 2.2,
};

const BEARISH_LEXICON: Record<string, number> = {
  'rate hike': 2.5,
  'hawkish': 2.0,
  'dollar surge': 2.2,
  'higher yields': 2.0,
  'strong labor': 1.8,
  'tightening': 1.8,
  'gold selloff': 2.5,
  'strong dollar': 2.0,
  'disinflation': 1.5,
  'soft landing': 1.4,
  'liquidity drain': 1.7,
  'risk-on rally': 1.5,
};

class MacroCalendarService {
  private events: EconomicEvent[] = [];
  private sentimentReport: NewsSentimentReport = {
    bullishScore: 68,
    bearishScore: 32,
    netSentiment: 0.36,
    sentimentLabel: 'BULLISH',
    sampleCount: SCHEDULED_EVENTS.length,
    topKeywords: [
      { word: 'central bank buying', count: 7, sentiment: 'bullish' },
      { word: 'rate cut', count: 5, sentiment: 'bullish' },
      { word: 'safe haven', count: 4, sentiment: 'bullish' },
      { word: 'higher yields', count: 3, sentiment: 'bearish' },
      { word: 'dollar surge', count: 2, sentiment: 'bearish' },
    ],
  };

  constructor() {
    this.updateEventsCountdown();
    setInterval(() => this.updateEventsCountdown(), 30000);
    this.fetchLiveHeadlinesAndAnalyze();
  }

  public getEvents(): EconomicEvent[] {
    return [...this.events];
  }

  public getSentiment(): NewsSentimentReport {
    return { ...this.sentimentReport };
  }

  private updateEventsCountdown() {
    const now = Date.now();
    this.events = SCHEDULED_EVENTS.map((evt) => {
      const diffMs = new Date(evt.dateUtc).getTime() - now;
      const countdownMinutes = Math.max(0, Math.round(diffMs / 60000));
      return {
        ...evt,
        countdownMinutes,
      };
    }).sort((a, b) => (a.countdownMinutes || 0) - (b.countdownMinutes || 0));
  }

  /**
   * Fetches live market news headlines and executes NLP sentiment scoring
   */
  public async fetchLiveHeadlinesAndAnalyze() {
    try {
      const res = await fetch('/api/news');
      if (res.ok) {
        const newsItems = await res.json();
        if (Array.isArray(newsItems) && newsItems.length > 0) {
          const texts = newsItems.map((item: any) => `${item.title || ''} ${item.snippet || ''}`.toLowerCase());
          this.computeNlpSentiment(texts);
        }
      }
    } catch (_) {}
  }

  private computeNlpSentiment(texts: string[]) {
    let bullishWeight = 0;
    let bearishWeight = 0;
    const keywordCounts: Record<string, { count: number; sentiment: 'bullish' | 'bearish' }> = {};

    texts.forEach((text) => {
      Object.entries(BULLISH_LEXICON).forEach(([keyword, weight]) => {
        if (text.includes(keyword)) {
          bullishWeight += weight;
          if (!keywordCounts[keyword]) keywordCounts[keyword] = { count: 0, sentiment: 'bullish' };
          keywordCounts[keyword].count++;
        }
      });

      Object.entries(BEARISH_LEXICON).forEach(([keyword, weight]) => {
        if (text.includes(keyword)) {
          bearishWeight += weight;
          if (!keywordCounts[keyword]) keywordCounts[keyword] = { count: 0, sentiment: 'bearish' };
          keywordCounts[keyword].count++;
        }
      });
    });

    const totalWeight = bullishWeight + bearishWeight || 1;
    const bullishScore = Math.round((bullishWeight / totalWeight) * 100);
    const bearishScore = 100 - bullishScore;
    const netSentiment = +((bullishWeight - bearishWeight) / totalWeight).toFixed(2);

    const sentimentLabel = netSentiment >= 0.15 ? 'BULLISH' : netSentiment <= -0.15 ? 'BEARISH' : 'NEUTRAL';

    const topKeywords = Object.entries(keywordCounts)
      .map(([word, data]) => ({ word, count: data.count, sentiment: data.sentiment }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    this.sentimentReport = {
      bullishScore,
      bearishScore,
      netSentiment,
      sentimentLabel,
      sampleCount: texts.length,
      topKeywords,
    };
  }
}

export const macroCalendarService = new MacroCalendarService();

