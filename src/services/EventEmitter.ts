// /src/services/ EventEmitter.ts

class EventEmitter {
	private events: { [key: string]: Function[] } = Object.create(null);
	private readonly blockedEvents = new Set([
		"__proto__",
		"constructor",
		"prototype",
	]);

	// Add an event listener
	on(event: string, listener: Function) {
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
		this.events[event].push(listener);
	}

	// Emit an event, calling all listeners
	emit(event: string, data?: any) {
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
	off(event: string, listener: Function) {
		if (this.blockedEvents.has(event)) {
			console.warn(
				"[Task Board] [Event Emitter] : Blocked event is un-registered : ",
				event,
			);
			return;
		}
		if (this.events[event]) {
			this.events[event] = this.events[event].filter(
				(registeredListener) => registeredListener !== listener,
			);
		}
	}
}

export const eventEmitter = new EventEmitter();
