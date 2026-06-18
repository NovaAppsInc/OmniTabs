declare global {
	interface Window {
		$scramjetVersion: any;
		$scramjetLoadController: any;
	}
}

export const wispURL = typeof window !== "undefined" && window.location && window.location.origin ? `${window.location.origin.replace(/^https?:\/\//, window.location.protocol === "https:" ? "wss://" : "ws://")}/wisp/` : "";