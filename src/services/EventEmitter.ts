// /src/services/ EventEmitter.ts

type EventListener<T = unknown> = (data: T) => void;

class EventEmitter {
	private events: Record<string, Array<EventListener<unknown>>> = {};
	private readonly blockedEvents = new Set([
		"__proto__",
		"constructor",
		"prototype",
	]);

	// Keep the listener payload generic at the call site, but store the handler
	// internally as `unknown` so the event bus remains compatible with the
	// existing callback signatures used across the plugin.
	on<T>(event: string, listener: EventListener<T>) {
		if (this.blockedEvents.has(event)) {
			console.warn(
				"[Task Board] [Event Emitter] : Blocked event is registered : ",
				event,
			);
			return;
		}
		if (!this.events[event]) {
			this.events[event] = [];
		}
		this.events[event].push(listener as EventListener<unknown>);
	}

	// Emit an event, calling all listeners
	emit<T>(event: string, data?: T) {
		if (this.blockedEvents.has(event)) {
			console.warn(
				"[Task Board] [Event Emitter] : Blocked event is emitted : ",
				event,
			);
			return;
		}
		if (this.events[event]) {
			this.events[event].forEach((listener) => listener(data));
		}
	}

	// Remove an event listener
	off<T>(event: string, listener: EventListener<T>) {
		if (this.blockedEvents.has(event)) {
			console.warn(
				"[Task Board] [Event Emitter] : Blocked event is un-registered : ",
				event,
			);
			return;
		}
		if (this.events[event]) {
			this.events[event] = this.events[event].filter(
				(registeredListener) =>
					registeredListener !== (listener as EventListener<unknown>),
			);
		}
	}
}

export const eventEmitter = new EventEmitter();
