import { FixMessage, FixTag, PaperOrder, PaperPosition, PaperTradeJournalEntry } from '../types/terminal';

const STORAGE_KEY = 'openterminal_fix_packets_v3';

const TAG_NAMES: Record<number, string> = {
  8: 'BeginString',
  9: 'BodyLength',
  35: 'MsgType',
  49: 'SenderCompID',
  56: 'TargetCompID',
  34: 'MsgSeqNum',
  52: 'SendingTime',
  11: 'ClOrdID',
  37: 'OrderID',
  17: 'ExecID',
  150: 'ExecType',
  39: 'OrdStatus',
  55: 'Symbol',
  54: 'Side',
  38: 'OrderQty',
  40: 'OrdType',
  44: 'Price',
  31: 'LastPx',
  32: 'LastQty',
  14: 'CumQty',
  6: 'AvgPx',
  151: 'LeavesQty',
  60: 'TransactTime',
  10: 'CheckSum',
};

type FixSubscriber = (messages: FixMessage[]) => void;

class FixProtocolEngine {
  private messages: FixMessage[] = [];
  private seqNum: number = 1001;
  private subscribers: Set<FixSubscriber> = new Set();

  constructor() {
    this.messages = this.loadMessages();
    if (this.messages.length === 0) {
      this.generateHeartbeat();
    }
  }

  public subscribe(cb: FixSubscriber): () => void {
    this.subscribers.add(cb);
    cb([...this.messages]);
    return () => this.subscribers.delete(cb);
  }

  public getMessages(): FixMessage[] {
    return [...this.messages];
  }

  public clearAuditTrail() {
    this.messages = [];
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    this.notify();
  }

  private loadMessages(): FixMessage[] {
    try {
      const s = localStorage.getItem(STORAGE_KEY);
      return s ? JSON.parse(s) : [];
    } catch {
      return [];
    }
  }

  private saveMessages() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.messages));
    } catch {}
  }

  private notify() {
    this.subscribers.forEach((cb) => {
      try {
        cb([...this.messages]);
      } catch (_) {}
    });
    this.saveMessages();
  }

  /**
   * Calculates standard FIX Checksum: Sum of all ASCII byte values modulo 256, formatted as 3 digits
   */
  private computeChecksum(rawWithoutChecksum: string): string {
    let sum = 0;
    for (let i = 0; i < rawWithoutChecksum.length; i++) {
      sum += rawWithoutChecksum.charCodeAt(i);
    }
    const mod = sum % 256;
    return mod.toString().padStart(3, '0');
  }

  private buildFixPacket(
    msgType: FixMessage['msgType'],
    typeLabel: string,
    bodyTags: { tag: number; value: string; desc: string }[]
  ): FixMessage {
    const seq = this.seqNum++;
    const sendingTime = new Date().toISOString().replace('T', '-').replace('Z', '');

    const standardHeader = [
      { tag: 35, value: msgType.replace('35=', ''), desc: typeLabel },
      { tag: 49, value: 'OPENTERM_DESK', desc: 'Sender Comp ID' },
      { tag: 56, value: 'LP_INSTITUTIONAL', desc: 'Target Comp ID' },
      { tag: 34, value: seq.toString(), desc: 'Message Sequence Number' },
      { tag: 52, value: sendingTime, desc: 'Sending Time (UTC)' },
    ];

    const allTags = [...standardHeader, ...bodyTags];

    // Compute raw string with body length and checksum
    let bodyString = '';
    allTags.forEach((t) => {
      bodyString += `${t.tag}=${t.value}\x01`;
    });

    const bodyLength = bodyString.length;
    const headerPrefix = `8=FIX.4.4\x019=${bodyLength}\x01`;
    const fullMessageBeforeChecksum = headerPrefix + bodyString;
    const checksum = this.computeChecksum(fullMessageBeforeChecksum);
    const rawFinal = `${fullMessageBeforeChecksum}10=${checksum}\x01`;

    const tags: FixTag[] = [
      { tag: 8, name: 'BeginString', value: 'FIX.4.4', description: 'FIX protocol version 4.4' },
      { tag: 9, name: 'BodyLength', value: bodyLength.toString(), description: 'Message body length in bytes' },
      ...allTags.map((t) => ({
        tag: t.tag,
        name: TAG_NAMES[t.tag] || `Tag${t.tag}`,
        value: t.value,
        description: t.desc,
      })),
      { tag: 10, name: 'CheckSum', value: checksum, description: 'Modulo 256 checksum' },
    ];

    const uid = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : performance.now().toFixed(0);
    const packet: FixMessage = {
      id: `fix_${Date.now()}_${uid}`,
      raw: rawFinal.replace(/\x01/g, ' | '),
      msgType,
      typeLabel,
      senderCompId: 'OPENTERM_DESK',
      targetCompId: 'LP_INSTITUTIONAL',
      seqNum: seq,
      timestamp: sendingTime,
      tags,
    };

    this.messages.unshift(packet);
    if (this.messages.length > 100) {
      this.messages.pop();
    }
    this.notify();
    return packet;
  }

  public recordNewOrderSingle(order: PaperOrder): FixMessage {
    return this.buildFixPacket('35=D', 'New Order Single (D)', [
      { tag: 11, value: order.id, desc: 'Client Order ID' },
      { tag: 55, value: order.symbol, desc: 'Symbol ticker' },
      { tag: 54, value: order.side === 'buy' ? '1' : '2', desc: order.side === 'buy' ? '1 (Buy)' : '2 (Sell)' },
      { tag: 38, value: order.lots.toString(), desc: 'Order quantity in standard lots' },
      { tag: 40, value: order.type === 'market' ? '1' : '2', desc: order.type === 'market' ? '1 (Market)' : '2 (Limit)' },
      { tag: 44, value: order.targetPrice.toFixed(2), desc: 'Target price' },
      { tag: 60, value: order.createdAt, desc: 'Transact time' },
    ]);
  }

  public recordExecutionReport(order: PaperOrder, fillPrice: number, execType: '2' | '4' = '2'): FixMessage {
    const isFill = execType === '2';
    return this.buildFixPacket('35=8', isFill ? 'Execution Report (Filled)' : 'Execution Report (Canceled)', [
      { tag: 37, value: `ord_inst_${Date.now()}`, desc: 'Broker Order ID' },
      { tag: 11, value: order.id, desc: 'Client Order ID' },
      { tag: 17, value: `exec_${Date.now()}`, desc: 'Unique Execution ID' },
      { tag: 150, value: execType, desc: isFill ? '2 (Filled)' : '4 (Canceled)' },
      { tag: 39, value: execType, desc: isFill ? '2 (Filled)' : '4 (Canceled)' },
      { tag: 55, value: order.symbol, desc: 'Instrument' },
      { tag: 54, value: order.side === 'buy' ? '1' : '2', desc: order.side === 'buy' ? '1 (Buy)' : '2 (Sell)' },
      { tag: 38, value: order.lots.toString(), desc: 'Order quantity' },
      { tag: 31, value: fillPrice.toFixed(2), desc: 'Last fill price' },
      { tag: 32, value: order.lots.toString(), desc: 'Last executed quantity' },
      { tag: 14, value: order.lots.toString(), desc: 'Cumulative quantity filled' },
      { tag: 6, value: fillPrice.toFixed(2), desc: 'Average executed price' },
      { tag: 151, value: '0', desc: 'Leaves quantity' },
    ]);
  }

  public recordOrderCancelRequest(orderId: string, symbol: string): FixMessage {
    return this.buildFixPacket('35=F', 'Order Cancel Request (F)', [
      { tag: 11, value: `cancel_${orderId}`, desc: 'Cancel Request ID' },
      { tag: 41, value: orderId, desc: 'Original Client Order ID' },
      { tag: 55, value: symbol, desc: 'Symbol ticker' },
      { tag: 60, value: new Date().toISOString(), desc: 'Cancel time' },
    ]);
  }

  public generateHeartbeat(): FixMessage {
    return this.buildFixPacket('35=0', 'Heartbeat (0)', [
      { tag: 112, value: 'PING_KEEP_ALIVE', desc: 'Heartbeat test request expression' },
    ]);
  }
}

export const fixProtocolEngine = new FixProtocolEngine();
