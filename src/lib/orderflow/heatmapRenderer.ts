import { HeatmapColumn, HeatmapCell } from '../types/orderFlow';

export interface HeatmapRenderOptions {
  canvas: HTMLCanvasElement;
  columns: HeatmapColumn[];
  priceMin: number;
  priceMax: number;
  width: number;
  height: number;
  dpi: number;
}

export class HeatmapRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private lut: Uint8ClampedArray;
  private dirty = true;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.lut = this.buildLUT();
  }

  private buildLUT(): Uint8ClampedArray {
    const lut = new Uint8ClampedArray(1024);
    for (let i = 0; i < 256; i++) {
      const a = i;
      lut[i*4] = 0; lut[i*4+1] = 230; lut[i*4+2] = 118; lut[i*4+3] = a;
    }
    return lut;
  }

  resize(w: number, h: number, dpi: number): void {
    this.canvas.width = w * dpi; this.canvas.height = h * dpi;
    this.ctx.setTransform(dpi, 0, 0, dpi, 0, 0);
    this.dirty = true;
  }

  render(opts: HeatmapRenderOptions): void {
    const { columns, priceMin, priceMax, width, height } = opts;
    this.ctx.clearRect(0, 0, width, height);
    const colW = width / Math.max(1, 1440);
    const priceSpan = Math.max(1e-9, priceMax - priceMin);
    for (let ci = 0; ci < columns.length; ci++) {
      const col = columns[ci];
      const x = width - (columns.length - ci) * colW;
      if (x + colW < 0) continue;
      for (const cell of col.dom) {
        const y = (1 - (cell.price - priceMin) / priceSpan) * height;
        const h = Math.max(1, (cell.size > 0 ? Math.min(255, Math.floor(Math.log10(cell.size + 1) * 80)) : 0));
        this.ctx.fillStyle = `rgba(0,230,118,${h/255})`;
        this.ctx.fillRect(x, y, colW, 2);
      }
    }
    this.dirty = false;
  }

  setDirty(): void { this.dirty = true; }
}
