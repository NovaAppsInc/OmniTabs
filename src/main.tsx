import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { BareMuxConnection } from '@mercuryworkshop/bare-mux'
import XOR from './libs/XOR'
import { wispURL } from "./types"

const loadScript = (src: string): Promise<void> => {
	return new Promise((resolve, reject) => {
		const existing = document.querySelector(`script[src="${src}"]`) as HTMLScriptElement | null;
		if (existing) {
			resolve();
			return;
		}

		const script = document.createElement('script');
		script.src = src;
		script.onload = () => resolve();
		script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
		document.head.appendChild(script);
	});
};

const waitForServiceWorkerController = async (): Promise<void> => {
	if (navigator.serviceWorker.controller) return;

	await new Promise<void>((resolve) => {
		const onChange = () => {
			navigator.serviceWorker.removeEventListener('controllerchange', onChange);
			resolve();
		};

		navigator.serviceWorker.addEventListener('controllerchange', onChange);

		setTimeout(() => {
			navigator.serviceWorker.removeEventListener('controllerchange', onChange);
			resolve();
		}, 1500);
	});
};

const regSw = async () => {
	await loadScript('/scramjet/scramjet.all.js');

	await navigator.serviceWorker.register('/sw.js', { scope: '/service/' });
	await navigator.serviceWorker.ready;
	await waitForServiceWorkerController();

	const connection = new BareMuxConnection("/baremux/worker.js");
	await connection.setTransport("/epoxy/index.mjs", [{ wisp: wispURL }]);

	if (!window.$scramjetLoadController) {
		throw new Error('Scramjet runtime not loaded: $scramjetLoadController is unavailable');
	}

	const { ScramjetController } = window.$scramjetLoadController();
	const scramjet = new ScramjetController({
		prefix: "/service/",
		files: {
			wasm: "/scramjet/scramjet.wasm.wasm",
			all: "/scramjet/scramjet.all.js",
			sync: "/scramjet/scramjet.sync.js",
		},
		defaultFlags: {
			rewriterLogs: false,
		},
		codec: XOR,
	});
	await scramjet.init();
};

regSw();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
