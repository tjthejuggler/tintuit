/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope;

interface ServiceWorkerGlobalScope {
  __WB_MANIFEST: Array<{
    revision: string | null;
    url: string;
  }>;
}

interface ExtendableEvent extends Event {
  waitUntil(fn: Promise<any>): void;
}

interface FetchEvent extends ExtendableEvent {
  request: Request;
  respondWith(response: Promise<Response> | Response): void;
}

interface InstallEvent extends ExtendableEvent {
  registerForeignFetch(options: {
    scopes: Array<string>;
    origins: Array<string>;
  }): void;
}

interface ActivateEvent extends ExtendableEvent {}

interface PushEvent extends ExtendableEvent {
  data: PushMessageData;
}

interface PushMessageData {
  arrayBuffer(): ArrayBuffer;
  blob(): Blob;
  json(): any;
  text(): string;
}

interface SyncEvent extends ExtendableEvent {
  lastChance: boolean;
  tag: string;
}

interface WindowClient extends Client {
  focused: boolean;
  visibilityState: DocumentVisibilityState;
  focus(): Promise<WindowClient>;
  navigate(url: string): Promise<WindowClient>;
}

interface Clients {
  claim(): Promise<void>;
  get(id: string): Promise<Client>;
  matchAll(options?: ClientQueryOptions): Promise<Array<Client>>;
  openWindow(url: string): Promise<WindowClient>;
}

interface ClientQueryOptions {
  includeUncontrolled?: boolean;
  type?: ClientType;
}

type ClientType = "window" | "worker" | "sharedworker" | "all";

interface NotificationEvent extends ExtendableEvent {
  action: string;
  notification: Notification;
}

interface PushSubscriptionChangeEvent extends ExtendableEvent {
  newSubscription?: PushSubscription;
  oldSubscription?: PushSubscription;
}
