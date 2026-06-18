import { type ReactNode } from "react";
import { Cog6ToothIcon, GlobeAltIcon, BookmarkIcon } from "@heroicons/react/24/solid";

import Home from "../views/Home";
import Settings from "../views/Settings";
import About from "../views/About";
import { Bookmarks } from "../views/Bookmarks";
import { ClockIcon } from "lucide-react";
import { History } from "../views/History";

export interface AboutPage {
	name: string;
	component: React.ComponentType<any>;
	icon?: ReactNode;
	title?: string;
	queryFields?: string[];
	hasQuery?: boolean;
}

export const INTERNAL_PROTOCOL = "omni://";
const LEGACY_INTERNAL_PROTOCOL = "about:";

export const aboutPages: Record<string, AboutPage> = {
	newtab: {
		name: "newtab",
		component: Home,
		icon: <GlobeAltIcon className="size-5" />,
		title: "New Tab",
	},
	settings: {
		name: "settings",
		component: Settings,
		icon: <Cog6ToothIcon className="size-5" />,
		title: "Settings",
	},
	about: {
		name: "about",
		component: About,
		icon: <Cog6ToothIcon className="size-5" />,
		title: "About",
	},
	bookmarks: {
		name: "bookmarks",
		component: Bookmarks,
		icon: <BookmarkIcon className="size-5" />,
		title: "Bookmarks",
	},
	history: {
		name: "history",
		component: History,
		icon: <ClockIcon className="size-5" />,
		title: "History",
	},
};

export const getPageFromUrl = (url: string): string | null => {
	if (url.startsWith(INTERNAL_PROTOCOL)) {
		return url.slice(INTERNAL_PROTOCOL.length).split("?")[0];
	}

	if (url.startsWith(LEGACY_INTERNAL_PROTOCOL)) {
		return url.slice(LEGACY_INTERNAL_PROTOCOL.length).split("?")[0];
	}

	return null;
};

export const getQueryFromUrl = (url: string): string | undefined => {
	if (!url.includes("?")) return undefined;
	return url.split("?")[1];
};

/**
 * Updates a tab's title and URL based on the current page state.
 * This should be called by pages when their content changes (e.g., selecting a specific item).
 *
 * @param tabId - The ID of the tab to update
 * @param pageName - The name of the about page (e.g., "games", "music")
 * @param options - Optional parameters for custom title/URL
 */
export const updatePageTab = (
	tabId: string,
	pageName: string,
	options?: {
		title?: string;
		query?: string;
	},
) => {
	const pageConfig = aboutPages[pageName];
	if (!pageConfig) return;

	const baseUrl = `${INTERNAL_PROTOCOL}${pageName}`;
	const url = options?.query ? `${baseUrl}?${options.query}` : baseUrl;
	const title = options?.title || pageConfig.title || pageName;

	// Dispatch navigation event
	const event = new CustomEvent("navigate", {
		detail: {
			url,
			title,
			icon: pageConfig.icon,
			displayUrl: url,
			id: tabId,
		},
	});
	window.dispatchEvent(event);
};
