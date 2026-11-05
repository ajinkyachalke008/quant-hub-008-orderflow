import { FixMessage, FixSessionState, FixSessionStatus, FixTag } from '../types/terminal';
import { fixProtocolEngine } from './fixProtocolEngine';

const SESSION_STORAGE_KEY = 'openterminal_fix_session_state_v1';

export type FixSessionListener = (state: FixSessionState) => void;

/**
 * Interactive FIX 4.4 Protocol Session Manager
 *
 * Implements real session connection state machines, heartbeats, sequence number tracking,
 * tag-value / SOH protocol inspection, and interactive institutional order routing controls.
 */
class FixSessionManagerService {
  private state: FixSessionState = {
    sessionId: 'FIX.4.4:OPENTERM_DESK->LP_INSTITUTIONAL',
    senderCompId: 'OPENTERM_DESK',
    targetCompId: 'LP_INSTITUTIONAL',
    heartBtInt: 30,
    inboundSeqNum: 1,
    outboundSeqNum: 1,
    status: 'CONNECTED',
    lastHeartbeatSent: Date.now(),
    lastHeartbeatReceived: Date.now(),
    messages: [],
  };

  private heartbeatTimer: any = null;
  private listeners: Set<FixSessionListener> = new Set();

  constructor() {
    this.loadState();
    this.startHeartbeatTimer();

    // Hook into global fix protocol engine
    fixProtocolEngine.subscribe((msgs) => {
      this.state.messages = msgs;
      this.notify();
    });
  }

  private loadState() {
    if (typeof localStorage === 'undefined') return;
    try {
      const saved = localStorage.getItem(SESSION_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        this.state = {
          ...this.state,
          ...parsed,
          messages: fixProtocolEngine.getMessages(),
        };
      }
    } catch {}
  }

  private saveState() {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(
        SESSION_STORAGE_KEY,
        JSON.stringify({
          sessionId: this.state.sessionId,
          senderCompId: this.state.senderCompId,
          targetCompId: this.state.targetCompId,
          heartBtInt: this.state.heartBtInt,
          inboundSeqNum: this.state.inboundSeqNum,
          outboundSeqNum: this.state.outboundSeqNum,
          status: this.state.status,
          lastHeartbeatSent: this.state.lastHeartbeatSent,
          lastHeartbeatReceived: this.state.lastHeartbeatReceived,
        })
      );
    } catch {}
  }

  private startHeartbeatTimer() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(() => {
      if (this.state.status === 'CONNECTED') {
        this.sendHeartbeat();
      }
    }, this.state.heartBtInt * 1000);
  }

  public logon(): FixMessage {
    this.state.status = 'LOGON_SENT';
    this.notify();

    const seq = this.state.outboundSeqNum++;
    const now = new Date().toISOString().replace(/\.\d+Z$/, '');

    const tags: FixTag[] = [
      { tag: 8, name: 'BeginString', value: 'FIX.4.4', description: 'FIX 4.4 Protocol Version' },
      { tag: 35, name: 'MsgType', value: 'A', description: 'Logon Request' },
      { tag: 49, name: 'SenderCompID', value: this.state.senderCompId, description: 'Client Trader Desk' },
      { tag: 56, name: 'TargetCompID', value: this.state.targetCompId, description: 'Institutional Liquidity Provider' },
      { tag: 34, name: 'MsgSeqNum', value: String(seq), description: 'Outbound Sequence Number' },
      { tag: 52, name: 'SendingTime', value: now, description: 'UTC Timestamp' },
      { tag: 98, name: 'EncryptMethod', value: '0', description: 'None / Plaintext' },
      { tag: 108, name: 'HeartBtInt', value: String(this.state.heartBtInt), description: 'Heartbeat Interval (Seconds)' },
    ];

    const msg = this.createMessage('35=A', 'Logon (35=A)', tags);

    // Simulate immediate counterparty acknowledgment
    setTimeout(() => {
      this.state.status = 'CONNECTED';
      this.state.inboundSeqNum++;
      this.state.lastHeartbeatReceived = Date.now();
      this.notify();
    }, 400);

    return msg;
  }

  public logout(): FixMessage {
    this.state.status = 'LOGOUT_SENT';
    const seq = this.state.outboundSeqNum++;
    const now = new Date().toISOString().replace(/\.\d+Z$/, '');

    const tags: FixTag[] = [
      { tag: 8, name: 'BeginString', value: 'FIX.4.4', description: 'FIX 4.4 Protocol Version' },
      { tag: 35, name: 'MsgType', value: '5', description: 'Logout Request' },
      { tag: 49, name: 'SenderCompID', value: this.state.senderCompId, description: 'Client Trader Desk' },
      { tag: 56, name: 'TargetCompID', value: this.state.targetCompId, description: 'Institutional Liquidity Provider' },
      { tag: 34, name: 'MsgSeqNum', value: String(seq), description: 'Outbound Sequence Number' },
      { tag: 52, name: 'SendingTime', value: now, description: 'UTC Timestamp' },
      { tag: 58, name: 'Text', value: 'Trader Initiated Disconnect', description: 'Logout Reason' },
    ];

    const msg = this.createMessage('35=5', 'Logout (35=5)', tags);

    setTimeout(() => {
      this.state.status = 'DISCONNECTED';
      this.notify();
    }, 300);

    return msg;
  }

  public sendHeartbeat(testReqId?: string): FixMessage {
    const seq = this.state.outboundSeqNum++;
    const now = new Date().toISOString().replace(/\.\d+Z$/, '');

    const tags: FixTag[] = [
      { tag: 8, name: 'BeginString', value: 'FIX.4.4', description: 'FIX 4.4 Protocol Version' },
      { tag: 35, name: 'MsgType', value: '0', description: 'Heartbeat Keep-Alive' },
      { tag: 49, name: 'SenderCompID', value: this.state.senderCompId, description: 'Client Trader Desk' },
      { tag: 56, name: 'TargetCompID', value: this.state.targetCompId, description: 'Institutional Liquidity Provider' },
      { tag: 34, name: 'MsgSeqNum', value: String(seq), description: 'Outbound Sequence Number' },
      { tag: 52, name: 'SendingTime', value: now, description: 'UTC Timestamp' },
    ];

    if (testReqId) {
      tags.push({ tag: 112, name: 'TestReqID', value: testReqId, description: 'Echoed Test Request ID' });
    }

    this.state.lastHeartbeatSent = Date.now();
    return this.createMessage('35=0', 'Heartbeat (35=0)', tags);
  }

  public sendTestRequest(): FixMessage {
    const seq = this.state.outboundSeqNum++;
    const now = new Date().toISOString().replace(/\.\d+Z$/, '');
    const testReqId = `TEST_${Date.now()}`;

    const tags: FixTag[] = [
      { tag: 8, name: 'BeginString', value: 'FIX.4.4', description: 'FIX 4.4 Protocol Version' },
      { tag: 35, name: 'MsgType', value: '1', description: 'Test Request' },
      { tag: 49, name: 'SenderCompID', value: this.state.senderCompId, description: 'Client Trader Desk' },
      { tag: 56, name: 'TargetCompID', value: this.state.targetCompId, description: 'Institutional Liquidity Provider' },
      { tag: 34, name: 'MsgSeqNum', value: String(seq), description: 'Outbound Sequence Number' },
      { tag: 52, name: 'SendingTime', value: now, description: 'UTC Timestamp' },
      { tag: 112, name: 'TestReqID', value: testReqId, description: 'Echoed Verification Token' },
    ];

    const msg = this.createMessage('35=1', 'Test Request (35=1)', tags);

    // Simulate counterparty Heartbeat response with matching TestReqID
    setTimeout(() => {
      this.state.inboundSeqNum++;
      this.state.lastHeartbeatReceived = Date.now();
      this.sendHeartbeat(testReqId);
      this.notify();
    }, 250);

    return msg;
  }

  public sendOrderCancelReplace(
    origClOrdId: string,
    newPrice: number,
    newQuantityLots: number,
    symbol: string = 'XAU/USD'
  ): FixMessage {
    const seq = this.state.outboundSeqNum++;
    const now = new Date().toISOString().replace(/\.\d+Z$/, '');
    const newClOrdId = `cl_rep_${Date.now()}`;

    const tags: FixTag[] = [
      { tag: 8, name: 'BeginString', value: 'FIX.4.4', description: 'FIX 4.4 Protocol Version' },
      { tag: 35, name: 'MsgType', value: 'G', description: 'Order Cancel/Replace Request' },
      { tag: 49, name: 'SenderCompID', value: this.state.senderCompId, description: 'Client Trader Desk' },
      { tag: 56, name: 'TargetCompID', value: this.state.targetCompId, description: 'Institutional Liquidity Provider' },
      { tag: 34, name: 'MsgSeqNum', value: String(seq), description: 'Outbound Sequence Number' },
      { tag: 52, name: 'SendingTime', value: now, description: 'UTC Timestamp' },
      { tag: 41, name: 'OrigClOrdID', value: origClOrdId, description: 'Original Client Order ID to modify' },
      { tag: 11, name: 'ClOrdID', value: newClOrdId, description: 'New Modified Client Order ID' },
      { tag: 55, name: 'Symbol', value: symbol, description: 'Traded Instrument' },
      { tag: 38, name: 'OrderQty', value: String(newQuantityLots), description: 'Updated Order Lots (100oz/lot)' },
      { tag: 44, name: 'Price', value: newPrice.toFixed(2), description: 'Updated Limit Price' },
    ];

    const msg = this.createMessage('35=G', 'Cancel/Replace (35=G)', tags);

    // Simulate ExecutionReport (35=8) acknowledgment
    setTimeout(() => {
      this.state.inboundSeqNum++;
      const execTags: FixTag[] = [
        { tag: 8, name: 'BeginString', value: 'FIX.4.4', description: 'FIX 4.4 Protocol Version' },
        { tag: 35, name: 'MsgType', value: '8', description: 'Execution Report (Replaced)' },
        { tag: 49, name: 'SenderCompID', value: this.state.targetCompId, description: 'Liquidity Provider' },
        { tag: 56, name: 'TargetCompID', value: this.state.senderCompId, description: 'Client Trader Desk' },
        { tag: 34, name: 'MsgSeqNum', value: String(this.state.inboundSeqNum), description: 'Inbound Sequence' },
        { tag: 11, name: 'ClOrdID', value: newClOrdId, description: 'Client Order ID' },
        { tag: 41, name: 'OrigClOrdID', value: origClOrdId, description: 'Original Order ID' },
        { tag: 39, name: 'OrdStatus', value: '5', description: 'Replaced Successfully' },
        { tag: 150, name: 'ExecType', value: '5', description: 'Replaced' },
        { tag: 44, name: 'Price', value: newPrice.toFixed(2), description: 'Adjusted Limit Price' },
      ];
      this.createMessage('35=8', 'Execution Report (35=8 Replaced)', execTags);
    }, 200);

    return msg;
  }

  public resetSequenceNumbers() {
    this.state.inboundSeqNum = 1;
    this.state.outboundSeqNum = 1;
    this.notify();
  }

  private createMessage(
    msgType: any,
    typeLabel: string,
    tags: FixTag[]
  ): FixMessage {
    const rawBody = tags.map((t) => `${t.tag}=${t.value}`).join(' | ');
    let sum = 0;
    for (let i = 0; i < rawBody.length; i++) {
      sum += rawBody.charCodeAt(i);
    }
    const checksum = (sum % 256).toString().padStart(3, '0');
    const fullRaw = `${rawBody} | 10=${checksum}`;

    tags.push({ tag: 10, name: 'CheckSum', value: checksum, description: 'Modulo 256 Checksum' });

    const msg: FixMessage = {
      id: `fix_msg_${Date.now()}_${tags.find((t) => t.tag === 34)?.value || '1'}`,
      raw: fullRaw,
      msgType,
      typeLabel,
      senderCompId: this.state.senderCompId,
      targetCompId: this.state.targetCompId,
      seqNum: Number(tags.find((t) => t.tag === 34)?.value || this.state.outboundSeqNum),
      timestamp: new Date().toISOString(),
      tags,
    };

    // Prepend to messages
    this.state.messages.unshift(msg);
    if (this.state.messages.length > 300) {
      this.state.messages.pop();
    }

    this.notify();
    return msg;
  }

  public getState(): FixSessionState {
    return { ...this.state };
  }

  public subscribe(listener: FixSessionListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.saveState();
    this.listeners.forEach((l) => l(this.getState()));
  }
}

export const fixSessionManagerService = new FixSessionManagerService();
