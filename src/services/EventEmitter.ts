// /src/services/ EventEmitter.ts

// import EventEmitter from "eventemitter3";

class EventEmitter {
	private events: { [key: string]: Function[] } = {};

	// Add an event listener
	on(event: string, listener: Function) {
		if (!this.events[event]) {
			this.events[event] = [];
		}
		this.events[event].push(listener);
	}

	// Emit an event, calling all listeners
	emit(event: string, data?: any) {
		if (this.events[event]) {
			this.events[event].forEach((listener) => listener(data));
		}
	}

	// Remove an event listener
	off(event: string, listener: Function) {
		if (this.events[event]) {
			this.events[event] = this.events[event].filter(
				(registeredListener) => registeredListener !== listener
			);
		}
	}
}

export const eventEmitter = new EventEmitter();
