import { useTabStore } from "../libs/store"
import { aboutPages, getPageFromUrl, getQueryFromUrl } from "../libs/aboutPages"
import XOR from "../libs/XOR"
import Home from "../views/Home"
import { InformationCircleIcon } from "@heroicons/react/24/solid"
import { INTERNAL_PROTOCOL } from "../libs/aboutPages"

export const PageView = () => {
    const { tabs, updateTab, isDialogOpen, omniboxOpen, omniboxSuggestions, omniboxSelectedIndex, setOmniboxOpen } = useTabStore()
    const splitView = true
    const activeTab = tabs.find(tab => tab.active === true);

    const resolveUrl = (input: string) => {
        const trimmed = input.trim();
        if (!trimmed) return `${INTERNAL_PROTOCOL}newtab`;
        if (trimmed.startsWith(INTERNAL_PROTOCOL)) return trimmed;
        if (trimmed.startsWith("about:")) return `${INTERNAL_PROTOCOL}${trimmed.slice(6)}`;
        if (trimmed.startsWith("/") || trimmed.startsWith("./") || trimmed.startsWith("../")) return trimmed;

        let formatted = trimmed;
        const hasSpace = formatted.includes(" ");
        const hasDot = formatted.includes(".");
        const looksLikeUrl = (hasDot && !hasSpace) || formatted.startsWith("http://") || formatted.startsWith("https://");

        if (looksLikeUrl) {
            if (!/^https?:\/\//i.test(formatted)) {
                formatted = `https://${formatted}`;
            }
        } else {
            formatted = `https://www.google.com/search?q=${encodeURIComponent(formatted)}`;
        }

        return formatted;
    };

    const applySuggestion = (value: string) => {
        const resolved = resolveUrl(value);

        if (activeTab) {
            updateTab(activeTab.id, { url: resolved });
        } else {
            useTabStore.getState().addTab({ url: resolved });
        }

        setOmniboxOpen(false);
    };

    const containerClass = "flex flex-col size-full min-h-0 gap-2 rounded-xl";
    const listClass = "flex flex-col bg-white/10 inset-shadow-[0_0_0_2px] inset-shadow-transparent rounded-xl " +
        (splitView ? "accent-inset-2-15" : "inset-shadow-transparent");
    const pageHostClass = "relative flex-1 min-h-0 flex items-center justify-center rounded-xl overflow-hidden " +
        (splitView ? "accent-inset-2-18" : "accent-inset-2-10") +
        " " +
        (isDialogOpen ? "pointer-events-none" : "");

    return (
        <div className={containerClass}>
            {/* omnibox */}
            {omniboxOpen && omniboxSuggestions.length > 0 && (
                <div className={listClass}>
                    {omniboxSuggestions.map((suggestion, index) => (
                        <button
                            key={suggestion.id}
                            className={"flex w-full p-3.5 justify-between leading-none duration-150 text-left " +
                                (index === omniboxSelectedIndex ? "bg-white/14" : "hover:bg-white/8")}
                            onMouseDown={(event) => {
                                event.preventDefault();
                                applySuggestion(suggestion.value);
                            }}
                        >
                            <div className="flex gap-2 items-center min-w-0">
                                <InformationCircleIcon className="size-4.5 shrink-0" />
                                <span className="font-bold truncate">{suggestion.label}</span>
                                {suggestion.subtitle ? (
                                    <span className="text-sm font-semibold leading-none opacity-50 p-1.5 px-2 rounded-md bg-white/10 inset-shadow-[0_0_0_1.5px] inset-shadow-white/25 truncate">
                                        {suggestion.subtitle}
                                    </span>
                                ) : null}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <span className="text-xs opacity-60 capitalize">{suggestion.kind}</span>
                            </div>
                        </button>
                    ))}
                </div>
            )}
            <div className={pageHostClass}>
                {tabs.length === 0 && <Home className="absolute inset-0" />}
                {
                    tabs.map((tab) => {
                        const refreshVersion = tab.refreshKey ?? 0;
                        const pageName = getPageFromUrl(tab.url);
                        if (pageName) {
                            const pageConfig = aboutPages[pageName]
                            const PageComponent = pageConfig.component

                            const query = pageConfig.hasQuery ? getQueryFromUrl(tab.url) : undefined

                            return (
                                <div key={`${tab.id}-${refreshVersion}`} className={"size-full" + " " + `${activeTab ? (activeTab.id !== tab.id ? "absolute opacity-0 translate-y-4 pointer-events-none duration-100" : "duration-200") : ""}`}>
                                    <PageComponent query={query} />
                                </div>
                            )
                        } else {
                            return (
                                <iframe
                                    key={`${tab.id}-${refreshVersion}`}
                                    className={"flex size-full border-none rounded-lg" + " " + `
                                        ${activeTab ? (activeTab.id !== tab.id ? "absolute opacity-0 translate-y-4 pointer-events-none duration-100" : "duration-250") : ""}
                                    `}
                                    src={`/service/${XOR.encode(tab.url)}`}
                                    onLoad={(e) => {
                                        try {
                                            const iframe = e.currentTarget;
                                            const doc = iframe.contentDocument || iframe.contentWindow?.document;
                                            if (doc) {
                                                const title = doc.title;
                                                const faviconEl = doc.querySelector("link[rel*='icon']") as HTMLLinkElement | null;
                                                const iconUrl = faviconEl ? faviconEl.href : new URL("/favicon.ico", iframe.src || window.location.origin).href;
                                                
                                                if (title || iconUrl) {
                                                    updateTab(tab.id, {
                                                        title: title || tab.title,
                                                        icon: iconUrl || tab.icon,
                                                    });
                                                }
                                            }
                                        } catch (err) {
                                            // Handled cross-origin safely (already populated with fallback in store)
                                        }
                                    }}
                                />
                            )
                        }
                    })
                }
            </div>
        </div>
    )
}