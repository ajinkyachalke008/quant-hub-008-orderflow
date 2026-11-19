import { FootprintCandle, FootprintCell } from '../types/orderFlow';

export interface FootprintRenderOptions {
  canvas: HTMLCanvasElement;
  candles: FootprintCandle[];  // aggregated per timeframe, fine[] = [row, sellVol, buyVol]
  priceMin: number;
  priceMax: number;
  width: number;
  height: number;
  dpi: number;
  tickSize: number;  // from exchangeInfo, e.g. 0.10 for BTCUSDT
  imbalanceThreshold: number;  // default 2.0x, user-configurable 1.5-4.0
}

export class FootprintRenderer {
  private ctx: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
  }

  resize(w: number, h: number, dpi: number): void {
    this.ctx.canvas.width = w * dpi;
    this.ctx.canvas.height = h * dpi;
    this.ctx.setTransform(dpi, 0, 0, dpi, 0, 0);
  }

  render(opts: FootprintRenderOptions): void {
    const { canvas, candles, priceMin, priceMax, width, height, tickSize, imbalanceThreshold } = opts;
    this.ctx.clearRect(0, 0, width, height);
    const priceSpan = Math.max(1e-9, priceMax - priceMin);
    const rowH = height / (priceSpan / tickSize);
    const candleW = width / Math.max(1, candles.length);

    for (let ci = 0; ci < candles.length; ci++) {
      const candle = candles[ci];
      const x = ci * candleW;
      for (const cell of candle.cells) {
        const y = (1 - (cell.row * tickSize - priceMin) / priceSpan) * height;
        const buyVol = cell.buyVol;
        const sellVol = cell.sellVol;
        const ratio = buyVol / Math.max(1e-9, sellVol);
        const isImbalance = ratio >= imbalanceThreshold;
        // buy volume = green (--ot-profit), sell volume = red (--ot-loss)
        // highlight imbalance rows
        if (buyVol > 0) {
          this.ctx.fillStyle = isImbalance ? 'var(--ot-amber)' : 'var(--ot-profit)';
          this.ctx.globalAlpha = Math.min(1, buyVol / 10);
          this.ctx.fillRect(x, y, candleW, rowH);
        }
        if (sellVol > 0) {
          this.ctx.fillStyle = 'var(--ot-loss)';
          this.ctx.globalAlpha = Math.min(1, sellVol / 10);
          this.ctx.fillRect(x, y, candleW, rowH);
        }
        this.ctx.globalAlpha = 1;
      }
    }
  }
}
