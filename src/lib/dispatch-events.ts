import { EventEmitter } from 'events';

// Create a global event emitter for Dispatch events.
// Using global object prevents multiple instances during Next.js HMR in dev.
const globalForEvents = global as unknown as { dispatchEventEmitter: EventEmitter };

export const dispatchEventEmitter =
  globalForEvents.dispatchEventEmitter || new EventEmitter();

if (process.env.NODE_ENV !== 'production') {
  globalForEvents.dispatchEventEmitter = dispatchEventEmitter;
}

// Ensure high max listeners just in case many SSE connections are open in dev
dispatchEventEmitter.setMaxListeners(100);

export const DISPATCH_EVENTS = {
  NEW_INCOMING_ORDER: 'NEW_INCOMING_ORDER',
  UPDATE_INCOMING_ORDER: 'UPDATE_INCOMING_ORDER',
  TRUCK_IMAGE_UPLOADED: 'TRUCK_IMAGE_UPLOADED',
};
