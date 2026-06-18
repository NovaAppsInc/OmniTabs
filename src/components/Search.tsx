import { useRef, useState, useEffect, useMemo } from "react";
import { useTabStore, type Tab, type OmniboxSuggestion } from "../libs/store"
import { INTERNAL_PROTOCOL, aboutPages } from "../libs/aboutPages";

interface SearchProps {
    tab?: Tab
}

const decodeProxyUrl = (url: string) => {
    if (!url) return url;
    if (url.startsWith("/service/")) {
        const encodedPart = url.slice(9);
        try {
            return decodeURIComponent(encodedPart);
        } catch {
            return encodedPart;
        }
    }
    return url;
};

const resolveUrl = (input: string) => {
    const trimmed = input.trim();
    if (!trimmed) return `${INTERNAL_PROTOCOL}newtab`;
    if (trimmed.startsWith(INTERNAL_PROTOCOL)) return trimmed;
    if (trimmed.startsWith("about:")) return `${INTERNAL_PROTOCOL}${trimmed.slice(6)}`;
    if (trimmed.startsWith("/") || trimmed.startsWith("./") || trimmed.startsWith("../")) return trimmed;

    if (trimmed.startsWith("/service/")) {
        return decodeProxyUrl(trimmed);
    }

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

const isLikelyUrlInput = (input: string) => {
    const trimmed = input.trim();
    if (!trimmed) return false;
    if (trimmed.startsWith(INTERNAL_PROTOCOL) || trimmed.startsWith("about:")) return true;
    if (/^https?:\/\//i.test(trimmed)) return true;
    if (trimmed.startsWith("/") || trimmed.startsWith("./") || trimmed.startsWith("../")) return true;

    const hasSpace = trimmed.includes(" ");
    const hasDot = trimmed.includes(".");
    return hasDot && !hasSpace;
};

const getDomainFromUrl = (url: string) => {
    try {
        const parsed = new URL(url);
        return parsed.hostname.replace(/^www\./i, "");
    } catch {
        return url;
    }
};

const renderStylizedUrl = (url: string) => {
    if (!url) return null;

    const spanClass = "truncate max-w-full text-center pointer-events-none font-medium select-none";

    if (url.startsWith(INTERNAL_PROTOCOL) || url.startsWith("about:")) {
        const legacyRest = url.startsWith("about:") ? url.slice(6) : "";
        const rest = url.startsWith(INTERNAL_PROTOCOL) ? url.slice(INTERNAL_PROTOCOL.length) : legacyRest;
        return (
            <div className={spanClass}>
                <span className="opacity-45">{INTERNAL_PROTOCOL}</span>
                <span className="text-white">{rest}</span>
            </div>
        );
    }

    const protocolMatch = url.match(/^(https?:\/\/)/i);
    if (protocolMatch) {
        const actualProtocol = protocolMatch[0];
        const remainder = url.slice(actualProtocol.length);

        const firstSlashIndex = remainder.indexOf("/");
        if (firstSlashIndex === -1) {
            return (
                <div className={spanClass}>
                    <span className="opacity-45">{actualProtocol}</span>
                    <span className="text-white">{remainder}</span>
                </div>
            );
        } else {
            const domain = remainder.slice(0, firstSlashIndex);
            const path = remainder.slice(firstSlashIndex);
            return (
                <div className={spanClass}>
                    <span className="opacity-45">{actualProtocol}</span>
                    <span className="text-white">{domain}</span>
                    <span className="opacity-45">{path}</span>
                </div>
            );
        }
    } else {
        const firstSlashIndex = url.indexOf("/");
        if (firstSlashIndex === -1) {
            const hasDot = url.includes(".");
            const hasSpace = url.includes(" ");
            if (hasDot && !hasSpace) {
                return (
                    <div className={spanClass}>
                        <span className="text-white">{url}</span>
                    </div>
                );
            } else {
                return (
                    <div className={spanClass}>
                        <span className="text-white/70">{url}</span>
                    </div>
                );
            }
        } else {
            const domain = url.slice(0, firstSlashIndex);
            const path = url.slice(firstSlashIndex);
            const hasDot = domain.includes(".");
            const hasSpace = domain.includes(" ");
            if (hasDot && !hasSpace) {
                return (
                    <div className={spanClass}>
                        <span className="text-white">{domain}</span>
                        <span className="opacity-45">{path}</span>
                    </div>
                );
            } else {
                return (
                    <div className={spanClass}>
                        <span className="text-white/70">{url}</span>
                    </div>
                );
            }
        }
    }
};

export const Search = ({tab}: SearchProps) => {
    const inputRef = useRef<HTMLInputElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)

    const tabs = useTabStore(state => state.tabs);
    const updateTab = useTabStore(state => state.updateTab)
    const addTab = useTabStore(state => state.addTab)
    const setOmniboxOpen = useTabStore(state => state.setOmniboxOpen)
    const setOmniboxSuggestions = useTabStore(state => state.setOmniboxSuggestions)
    const setOmniboxSelectedIndex = useTabStore(state => state.setOmniboxSelectedIndex)
    const activeTab = tabs.find(tab => tab.active === true);
    const [hasQuery, setHasQuery] = useState<boolean>(Boolean(tab?.url))
    const [focused, setFocused] = useState<boolean>(false)
    const [urlValue, setUrlValue] = useState<string>(decodeProxyUrl(activeTab?.url ?? ""))
    const [remoteSearchSuggestions, setRemoteSearchSuggestions] = useState<string[]>([])
    const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState<number>(-1)

    useEffect(() => {
        if (!inputRef.current) return;

        if (activeTab) {
            const decoded = decodeProxyUrl(activeTab.url);
            inputRef.current.value = decoded;
            setUrlValue(decoded);
            setHasQuery(!!activeTab.url);
            return;
        }

        inputRef.current.value = "";
        setUrlValue("");
        setHasQuery(false);
    }, [activeTab]);

    useEffect(() => {
        const query = urlValue.trim();

        if (!focused || !query || isLikelyUrlInput(query)) {
            setRemoteSearchSuggestions([]);
            return;
        }

        const controller = new AbortController();
        const timeout = window.setTimeout(async () => {
            try {
                const response = await fetch(
                    `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(query)}`,
                    { signal: controller.signal },
                );

                if (!response.ok) {
                    setRemoteSearchSuggestions([]);
                    return;
                }

                const data = await response.json();

                if (Array.isArray(data) && Array.isArray(data[1])) {
                    const next = data[1]
                        .filter((item): item is string => typeof item === "string")
                        .slice(0, 6);
                    setRemoteSearchSuggestions(next);
                    return;
                }

                if (Array.isArray(data)) {
                    const next = data
                        .map((item) => (typeof item === "object" && item && "phrase" in item ? String((item as { phrase: string }).phrase) : ""))
                        .filter(Boolean)
                        .slice(0, 6);
                    setRemoteSearchSuggestions(next);
                    return;
                }

                setRemoteSearchSuggestions([]);
            } catch {
                setRemoteSearchSuggestions([]);
            }
        }, 160);

        return () => {
            window.clearTimeout(timeout);
            controller.abort();
        };
    }, [focused, urlValue]);

    const omniboxSuggestions = useMemo<OmniboxSuggestion[]>(() => {
        const query = urlValue.trim();
        if (!query) return [];

        const list: OmniboxSuggestion[] = [];
        const seen = new Set<string>();

        const addSuggestion = (suggestion: OmniboxSuggestion) => {
            const key = `${suggestion.kind}:${suggestion.value.toLowerCase()}`;
            if (seen.has(key)) return;
            seen.add(key);
            list.push(suggestion);
        };

        const resolvedQueryUrl = resolveUrl(query);
        addSuggestion({
            id: "navigate-current",
            label: isLikelyUrlInput(query) ? `Go to ${resolvedQueryUrl}` : `Search for \"${query}\"`,
            value: query,
            subtitle: isLikelyUrlInput(query) ? "Website or path" : "Search",
            kind: "navigate",
        });

        Object.values(aboutPages)
            .filter((page) => {
                const title = (page.title || page.name).toLowerCase();
                const name = page.name.toLowerCase();
                const q = query.toLowerCase();
                return title.includes(q) || name.includes(q);
            })
            .slice(0, 4)
            .forEach((page) => {
                addSuggestion({
                    id: `internal-${page.name}`,
                    label: page.title || page.name,
                    value: `${INTERNAL_PROTOCOL}${page.name}`,
                    subtitle: "Internal page",
                    kind: "internal",
                });
            });

        tabs
            .filter((existingTab) => {
                const q = query.toLowerCase();
                return existingTab.title.toLowerCase().includes(q) || existingTab.url.toLowerCase().includes(q);
            })
            .slice(0, 5)
            .forEach((existingTab) => {
                addSuggestion({
                    id: `tab-${existingTab.id}`,
                    label: existingTab.title,
                    value: existingTab.url,
                    subtitle: getDomainFromUrl(existingTab.url),
                    kind: "tab",
                });
            });

        if (!isLikelyUrlInput(query)) {
            remoteSearchSuggestions.forEach((term, index) => {
                addSuggestion({
                    id: `search-${index}`,
                    label: term,
                    value: term,
                    subtitle: "Popular search",
                    kind: "search",
                });
            });
        }

        return list.slice(0, 8);
    }, [remoteSearchSuggestions, tabs, urlValue]);

    useEffect(() => {
        setSelectedSuggestionIndex(-1);
    }, [urlValue, focused]);

    useEffect(() => {
        setOmniboxSuggestions(omniboxSuggestions);
    }, [omniboxSuggestions, setOmniboxSuggestions]);

    useEffect(() => {
        setOmniboxSelectedIndex(selectedSuggestionIndex);
    }, [selectedSuggestionIndex, setOmniboxSelectedIndex]);

    useEffect(() => {
        setOmniboxOpen(focused && omniboxSuggestions.length > 0);

        if (!(focused && omniboxSuggestions.length > 0)) {
            setOmniboxSelectedIndex(-1);
        }
    }, [focused, omniboxSuggestions.length, setOmniboxOpen, setOmniboxSelectedIndex]);

    useEffect(() => {
        const handleVoiceQuery = (event: Event) => {
            const customEvent = event as CustomEvent<{ query?: string }>;
            const spokenQuery = String(customEvent.detail?.query ?? "").trim();
            if (!spokenQuery) return;

            if (inputRef.current) {
                inputRef.current.value = spokenQuery;
            }

            setUrlValue(spokenQuery);
            setHasQuery(true);

            const resolved = resolveUrl(spokenQuery);

            if (tab) {
                updateTab(tab.id, {
                    url: resolved,
                });
            } else {
                addTab({
                    url: resolved,
                });
            }

            setFocused(false);
            setSelectedSuggestionIndex(-1);
            setOmniboxOpen(false);
        };

        window.addEventListener("omni:voice-query", handleVoiceQuery);

        return () => {
            window.removeEventListener("omni:voice-query", handleVoiceQuery);
        };
    }, [addTab, setOmniboxOpen, tab, updateTab]);

    const applySuggestion = (suggestion: OmniboxSuggestion) => {
        const targetValue = suggestion.value;
        const resolved = resolveUrl(targetValue);

        if (tab) {
            updateTab(tab.id, {
                url: resolved,
            });
        } else {
            addTab({
                url: resolved,
            });
        }

        if (inputRef.current) {
            inputRef.current.value = targetValue;
        }
        setUrlValue(targetValue);
        setFocused(false);
        setSelectedSuggestionIndex(-1);
        setOmniboxOpen(false);
    };

    return (
        <div ref={containerRef} className={"relative flex items-center min-w-60 gap-2 rounded-xl duration-150" + " " + `
            ${
                tabs && tabs.length > 0 && tab && tab.active !== true ? "absolute translate-y-8 opacity-0 pointer-events-none" : ""
            }
            ${
                focused === true ? "bg-white/10 accent-inset-2-18" : "bg-white/10 accent-inset-2-8"
            }
        `}>
            <span className={"absolute left-1/2 -translate-x-1/2 font-semibold ease-in-out pointer-events-none w-max" + " " + `
                ${
                    hasQuery ? "opacity-0 -translate-x-1 duration-100" : hasQuery === false && focused ? "duration-150 opacity-70" : "duration-150 opacity-45"
                }
                `}>Search or enter URL</span>
            <input ref={inputRef} type="search" className={`size-full p-2 px-3 text-center font-medium focus:outline-none focus:ring-0 z-10 duration-150 ${
                !focused && hasQuery ? "text-transparent" : "text-(--text-secondary)"
            }`}
            onFocus={(e) => {
                const input = e.currentTarget
                setFocused(true)
                const hasSelection =
                input.selectionStart !== null &&
                input.selectionEnd !== null &&
                input.selectionStart !== input.selectionEnd
                
                if (!hasSelection) {
                    requestAnimationFrame(() => {
                        input.select()
                    })
                }
            }}
            onBlur={() => {
                window.setTimeout(() => {
                    setFocused(false)
                    setSelectedSuggestionIndex(-1)
                    setOmniboxOpen(false)
                }, 90)
            }}
            onChange={(e) => {
                const value = (e.target as HTMLInputElement).value;
                setUrlValue(value);
                if (value !== "") {
                    setHasQuery(true)
                } else {
                    setHasQuery(false)
                }
            }}
            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                if (e.key === "ArrowDown" && omniboxSuggestions.length > 0) {
                    e.preventDefault();
                    setSelectedSuggestionIndex((prev) => (prev + 1) % omniboxSuggestions.length);
                    return;
                }

                if (e.key === "ArrowUp" && omniboxSuggestions.length > 0) {
                    e.preventDefault();
                    setSelectedSuggestionIndex((prev) =>
                        prev <= 0 ? omniboxSuggestions.length - 1 : prev - 1,
                    );
                    return;
                }

                if (e.key === "Enter") {
                    if (selectedSuggestionIndex >= 0 && omniboxSuggestions[selectedSuggestionIndex]) {
                        e.preventDefault();
                        applySuggestion(omniboxSuggestions[selectedSuggestionIndex]);
                        e.currentTarget.blur()
                        return;
                    }

                    if (typeof inputRef.current?.value === "string") {
                        const resolved = resolveUrl(inputRef.current.value);

                        if (tab) {
                            updateTab(tab.id, {
                                url: resolved
                            })
                        } else {
                            addTab({
                                url: resolved,
                            })
                        }
                    }
                    e.currentTarget.blur()
                }

                if (e.key === "Escape") {
                    setSelectedSuggestionIndex(-1);
                    setFocused(false);
                    setOmniboxOpen(false);
                }
            }} />
            {!focused && hasQuery && urlValue && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 p-2 px-3">
                    {renderStylizedUrl(urlValue)}
                </div>
            )}
        </div>
    )
}