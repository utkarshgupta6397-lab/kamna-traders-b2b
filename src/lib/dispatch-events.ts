import { EventEmitter } from 'events';

// Create a global event emitter for Dispatch events.
// Use globalThis with Symbol/property to guarantee singleton identity across HMR and module bundles in dev.
interface GlobalWithEventEmitter {
  __dispatchEventEmitter?: EventEmitter;
  __dispatchEmitterId?: string;
}

const g = globalThis as unknown as GlobalWithEventEmitter;

if (!g.__dispatchEventEmitter) {
  g.__dispatchEventEmitter = new EventEmitter();
  g.__dispatchEmitterId = `EMITTER_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  g.__dispatchEventEmitter.setMaxListeners(100);
}

export const dispatchEventEmitter: EventEmitter = g.__dispatchEventEmitter;
export const dispatchEmitterId: string = g.__dispatchEmitterId || 'UNKNOWN';

export const DISPATCH_EVENTS = {
  NEW_INCOMING_ORDER: 'NEW_INCOMING_ORDER',
  UPDATE_INCOMING_ORDER: 'UPDATE_INCOMING_ORDER',
  TRUCK_IMAGE_UPLOADED: 'TRUCK_IMAGE_UPLOADED',
  INVOICE_CREATED: 'INVOICE_CREATED',
};
