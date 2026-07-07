import { useEffect, useMemo, useRef, useState } from "react";
import { HomeIcon, ArrowRightIcon, ArrowLeftIcon, AdjustmentsHorizontalIcon, ArrowPathIcon, StarIcon, UserCircleIcon, MicrophoneIcon, MagnifyingGlassIcon, EllipsisHorizontalIcon, PlusIcon } from "@heroicons/react/24/solid";
import { RectangleStackIcon as RectangleStackOutline, Cog6ToothIcon } from "@heroicons/react/24/outline";
import { BookmarkIcon, ClipboardIcon, ClockIcon, CopyIcon, PanelBottomClose, PanelBottomOpen, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, PanelTopClose, PanelTopOpen, ShieldCheck, ShieldQuestionMark } from "lucide-react";
import { useBookmarkStore, useSettingsStore, useTabStore } from "../libs/store";
import { INTERNAL_PROTOCOL } from "../libs/aboutPages";
import { Search } from "./Search";
import { ContextDialog } from "./ContextDialog";
import type { DialogOption } from "./ContextDialog";

type VoiceRecognition = {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    maxAlternatives: number;
    start: () => void;
    stop: () => void;
    abort: () => void;
    onresult: ((event: Event) => void) | null;
    onerror: ((event: Event) => void) | null;
    onend: (() => void) | null;
};

type VoiceWindow = Window & typeof globalThis & {
    SpeechRecognition?: new () => VoiceRecognition;
    webkitSpeechRecognition?: new () => VoiceRecognition;
};

const getSecurityState = (url?: string) => {
    if (!url) return "unknown";
    if (url.startsWith("https://")) return "secure";
    return "unknown";
};

const getHostFromUrl = (url?: string) => {
    if (!url) return "Unknown site";
    if (url.startsWith(INTERNAL_PROTOCOL) || url.startsWith("about:")) return "Internal page";

    try {
        const parsed = new URL(url);
        return parsed.hostname.replace(/^www\./i, "");
    } catch {
        return "Unknown site";
    }
}; 

export const TopBar = () => {
    const { tabs, tabsOpen, setTabState, addTab, setDialogOpen, navigateBack, navigateForward, updateTab } = useTabStore()
    const bookmarkEntries = useBookmarkStore((state) => state.entries)
    const toggleBookmark = useBookmarkStore((state) => state.toggleBookmark)
    const activeTab = tabs.find(tab => tab.active === true);
    const { tabPosition } = useSettingsStore()
    const securityState = getSecurityState(activeTab?.url);
    const SecurityIcon = securityState === "secure" ? ShieldCheck : ShieldQuestionMark;
    const siteHost = useMemo(() => getHostFromUrl(activeTab?.url), [activeTab?.url]);
    const canGoBack = Boolean(activeTab && (activeTab.historyIndex ?? 0) > 0);
    const canGoForward = Boolean(activeTab && activeTab.history && (activeTab.historyIndex ?? 0) < activeTab.history.length - 1);
    const canRefresh = Boolean(activeTab);
    const canBookmark = Boolean(activeTab?.url && !activeTab.url.startsWith(INTERNAL_PROTOCOL) && !activeTab.url.startsWith("about:"));
    const isBookmarked = Boolean(activeTab?.url && bookmarkEntries.some((entry) => entry.url === activeTab.url));

    const [openMenu, setOpenMenu] = useState<"none" | "security" | "browser">("none");
    const [isListening, setIsListening] = useState(false);
    const securityMenuRef = useRef<HTMLDivElement>(null);
    const browserMenuRef = useRef<HTMLDivElement>(null);
    const recognitionRef = useRef<VoiceRecognition | null>(null);

    const SpeechRecognitionCtor = useMemo(() => {
        if (typeof window === "undefined") return undefined;
        const voiceWindow = window as VoiceWindow;
        return voiceWindow.SpeechRecognition ?? voiceWindow.webkitSpeechRecognition;
    }, []);
    const isVoiceSupported = Boolean(SpeechRecognitionCtor);

    useEffect(() => {
        const handlePointerDown = (event: MouseEvent) => {
            const target = event.target as Node;
            const inSecurity = securityMenuRef.current?.contains(target);
            const inBrowser = browserMenuRef.current?.contains(target);

            if (!inSecurity && !inBrowser) {
                setOpenMenu("none");
            }
        };

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setOpenMenu("none");
            }
        };

        document.addEventListener("mousedown", handlePointerDown);
        document.addEventListener("keydown", handleEscape);

        return () => {
            document.removeEventListener("mousedown", handlePointerDown);
            document.removeEventListener("keydown", handleEscape);
        };
    }, []);

    useEffect(() => {
        return () => {
            recognitionRef.current?.abort();
            recognitionRef.current = null;
        };
    }, []);

    useEffect(() => {
        setDialogOpen(openMenu !== "none");
        return () => setDialogOpen(false);
    }, [openMenu, setDialogOpen]);

    const handleCopyAddress = async () => {
        if (!activeTab?.url) return;
        try {
            await navigator.clipboard.writeText(activeTab.url);
        } catch {
        }
        setOpenMenu("none");
    };

    const handleDuplicateTab = () => {
        if (!activeTab) return;
        addTab({
            title: activeTab.title,
            url: activeTab.url,
            icon: activeTab.icon,
        });
        setOpenMenu("none");
    };

    const handleNewTab = () => {
        addTab({
            title: "New Tab",
            url: `${INTERNAL_PROTOCOL}newtab`,
        });
        setOpenMenu("none");
    };

    const handleSettings = () => {
        addTab({
            title: "Settings",
            url: `${INTERNAL_PROTOCOL}settings`,
        })
        setOpenMenu("none");
    };

    const handleBookmarks = () => {
        addTab({
            title: "Bookmarks",
            url: `${INTERNAL_PROTOCOL}bookmarks`,
        });
        setOpenMenu("none");
    };

    const handleHistory = () => {
        addTab({
            title: "History",
            url: `${INTERNAL_PROTOCOL}history`,
        });
        setOpenMenu("none");
    };

    const handleHome = () => {
        const homeUrl = `${INTERNAL_PROTOCOL}newtab`;

        if (activeTab) {
            updateTab(activeTab.id, {
                url: homeUrl,
            });
            return;
        }

        addTab({
            url: homeUrl,
        });
    };

    const handleBookmark = () => {
        if (!activeTab || !canBookmark) return;

        toggleBookmark({
            url: activeTab.url,
            title: activeTab.title,
            icon: activeTab.icon,
        });
    };

    const handleVoiceSearch = () => {
        if (!isVoiceSupported || !SpeechRecognitionCtor) return;

        if (isListening) {
            recognitionRef.current?.stop();
            return;
        }

        if (!recognitionRef.current) {
            const recognition = new SpeechRecognitionCtor();
            recognition.continuous = false;
            recognition.interimResults = true;
            recognition.lang = "en-US";
            recognition.maxAlternatives = 1;

            recognition.onresult = (event) => {
                const anyEvent = event as {
                    resultIndex?: number;
                    results?: ArrayLike<ArrayLike<{ transcript?: string }> & { isFinal?: boolean }>;
                };
                const index = anyEvent.resultIndex ?? 0;
                const result = anyEvent.results?.[index];
                const transcript = String(result?.[0]?.transcript ?? "").trim();
                const isFinal = Boolean(result?.isFinal ?? true);

                if (!transcript || !isFinal) return;

                window.dispatchEvent(new CustomEvent("omni:voice-query", {
                    detail: { query: transcript },
                }));
            };

            recognition.onerror = () => {
                setIsListening(false);
            };

            recognition.onend = () => {
                setIsListening(false);
            };

            recognitionRef.current = recognition;
        }

        try {
            recognitionRef.current.start();
            setIsListening(true);
        } catch {
            setIsListening(false);
        }
    };

    const browserOptions: DialogOption[] = [
        { 
            label: "New Tab",
            icon: <PlusIcon className="size-5 stroke-1 stroke-current" />,
            onSelect: handleNewTab,
        },
        {
            label: "Duplicate Tab",
            icon: <CopyIcon className="size-5 stroke-2 stroke-current" />,
            onSelect: handleDuplicateTab,
        },
        { 
            label: "Copy Address", 
            icon: <ClipboardIcon className="size-5 stroke-2 stroke-current" />,
            onSelect: handleCopyAddress,
        },
        { type: "divider" },
        {
            label: "Bookmarks",
            icon: <BookmarkIcon className="size-5" />,
            onSelect: handleBookmarks,
        },
        {
            label: "History",
            icon: <ClockIcon className="size-5" />,
            onSelect: handleHistory,
        },
        // {
        //     label: "Extensions & Themes",
        //     icon: <Blocks className="size-5" />,
        //     onSelect: () => {},
        // },
        // { type: "divider" },
        {
            label: "Settings",
            icon: <Cog6ToothIcon className="size-5 stroke-2" />,
            onSelect: handleSettings,
        }
    ];

    return (
        <div className={"flex gap-2 items-center justify-between"}>
            <div className="flex gap-2 h-max p-2.5 bg-(--accent)/10 accent-inset-1_5-10 rounded-xl">
                <button className={"group flex items-center justify-center duration-150" + " " + (canGoBack ? "opacity-80 hover:opacity-100 cursor-pointer" : "opacity-40 cursor-not-allowed")}
                onClick={() => {
                    if (activeTab && canGoBack) {
                        navigateBack(activeTab.id);
                    }
                }}>
                    <ArrowLeftIcon className={"size-5 stroke-2 stroke-current duration-150" + " " + (canGoBack ? "group-hover:scale-80" : "")} />
                </button>
                <button className={"group flex items-center justify-center duration-150 " + (canGoForward ? "opacity-80 hover:opacity-100 cursor-pointer" : "opacity-40 cursor-not-allowed")}
                onClick={() => {
                    if (activeTab && canGoForward) {
                        navigateForward(activeTab.id);
                    }
                }}>
                    <ArrowRightIcon className={"size-5 stroke-2 stroke-current duration-150" + " " + (canGoForward ? "group-hover:scale-80" : "")} />
                </button>
                <button className={"group flex items-center justify-center duration-150 " + (canRefresh ? "opacity-80 hover:opacity-100 cursor-pointer" : "opacity-40 cursor-not-allowed")}
                onClick={() => {
                    if (!activeTab) return;
                    updateTab(activeTab.id, {
                        refreshKey: (activeTab.refreshKey ?? 0) + 1,
                    });
                }}>
                    <ArrowPathIcon className="size-5 stroke-1 stroke-current group-hover:scale-80 group-hover:rotate-45 duration-150" />
                </button>
                <button className="group flex items-center justify-center opacity-80 hover:opacity-100 cursor-pointer duration-150"
                onClick={handleHome}>
                    <HomeIcon className="size-5 group-hover:scale-80 duration-150" />
                </button>
            </div>

            <div className="flex gap-2 items-center">
                <div ref={securityMenuRef} className="relative flex gap-2 h-max p-2.5 bg-(--accent)/10 accent-inset-1_5-10 rounded-xl">
                    {
                    tabPosition === "top" || tabPosition === "bottom" ?
                        <button className="group flex items-center justify-center opacity-80 hover:opacity-100 cursor-not-allowed duration-150">
                            <UserCircleIcon className="size-5 group-hover:scale-80 duration-150" />
                        </button>
                    : null
                    }
                    <button
                        className="group flex items-center justify-center opacity-80 hover:opacity-100 cursor-pointer duration-150"
                        onClick={() => setOpenMenu(openMenu === "security" ? "none" : "security")}
                    >
                        <SecurityIcon className="size-5 group-hover:scale-80 duration-150" />
                    </button>
                    <ContextDialog
                        open={openMenu === "security"}
                        widthClass="w-84"
                        customContent={
                            <>
                                <div className="p-4 border-b border-(--accent)/15 bg-(--accent)/10">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-center gap-2.5">
                                            <div className="rounded-full p-2 bg-(--accent)/10 accent-inset-1-15">
                                                <SecurityIcon className="size-4.5" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold leading-none">{siteHost}</p>
                                                <p className="text-xs opacity-70 mt-1">
                                                    {securityState === "secure" ? "Connection is secure" : "Connection security unknown"}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-3 space-y-2">
                                    <div className="flex items-center justify-between p-2.5 bg-(--accent)/8 border border-(--accent)/10 rounded-lg">
                                        <div className="flex flex-col">
                                            <p className="text-xs opacity-70">Site</p>
                                            <p className="text-sm truncate">{activeTab?.url ? siteHost : "No active URL"}</p>
                                        </div>
                                        <button className="flex items-center justify-center mr-2 opacity-80 hover:opacity-100 cursor-pointer duration-150" onClick={handleCopyAddress}>
                                            <ClipboardIcon className="size-5" />
                                        </button>
                                    </div>

                                    <div className="rounded-lg bg-(--accent)/8 border border-(--accent)/10 p-2.5">
                                        <p className="text-xs opacity-70">Data</p>
                                        <p className="text-sm">Cookies and site data may be stored by this page.</p>
                                    </div>
                                </div>
                            </>
                        }
                    />
                    <button className="group flex items-center justify-center opacity-80 hover:opacity-100 cursor-not-allowed duration-150">
                        <AdjustmentsHorizontalIcon className="size-5 group-hover:scale-80 duration-150" />
                    </button>
                </div>
                <Search tab={activeTab} />
                <div className="flex gap-2 h-max p-2.5 bg-(--accent)/10 accent-inset-1_5-10 rounded-xl">
                    <button
                        className={"group flex items-center justify-center duration-150 " + (canBookmark ? "cursor-pointer" : "cursor-not-allowed") + " " + (isBookmarked ? "text-amber-300 opacity-100" : "opacity-80 hover:opacity-100")}
                        onClick={handleBookmark}
                        disabled={!canBookmark}
                        title={isBookmarked ? "Remove bookmark" : "Add bookmark"}
                    >
                        <StarIcon className="size-5 stroke-1 stroke-current group-hover:scale-80 duration-150" />
                    </button>
                    <button
                        className={"group flex items-center justify-center duration-150 " + (
                            isVoiceSupported
                                ? (isListening ? "cursor-pointer text-red-300 opacity-100" : "cursor-pointer opacity-80 hover:opacity-100")
                                : "cursor-not-allowed opacity-40"
                        )}
                        onClick={handleVoiceSearch}
                        disabled={!isVoiceSupported}
                        title={isVoiceSupported ? (isListening ? "Stop voice search" : "Start voice search") : "Voice search is not supported in this browser"}
                    >
                        <MicrophoneIcon className="size-5 stroke-1 stroke-current group-hover:scale-80 duration-150" />
                    </button>
                    <button className="group flex items-center justify-center opacity-80 hover:opacity-100 cursor-pointer duration-150">
                        <MagnifyingGlassIcon className="size-5 stroke-1 stroke-current group-hover:scale-80 duration-150" />
                    </button>
                </div>
            </div>

            <div ref={browserMenuRef} className="relative flex p-2 gap-2 bg-(--accent)/10 accent-inset-1_5-10 rounded-xl">
                <button className="group flex items-center justify-center opacity-80 hover:opacity-100 cursor-pointer duration-150" onMouseDown={() => {
                    tabsOpen === true ? setTabState(false) : setTabState(true)
                }}>
                    {
                    tabsOpen === true ?
                        tabPosition === "left" ? <PanelLeftClose className="size-5.5 group-hover:scale-80 duration-150" /> : 
                        tabPosition === "right" ? <PanelRightClose className="size-5.5 group-hover:scale-80 duration-150" /> : 
                        tabPosition === "top" ? <PanelTopClose className="size-5.5 group-hover:scale-80 duration-150" /> :
                        tabPosition === "bottom" ? <PanelBottomClose className="size-5.5 group-hover:scale-80 duration-150" /> : 
                            <RectangleStackOutline className="size-5.5 group-hover:scale-80 duration-150" /> :
                        tabPosition === "left" ? <PanelLeftOpen className="size-5.5 group-hover:scale-80 duration-150" /> : 
                        tabPosition === "right" ? <PanelRightOpen className="size-5.5 group-hover:scale-80 duration-150" /> : 
                        tabPosition === "top" ? <PanelTopOpen className="size-5.5 group-hover:scale-80 duration-150" /> :
                        tabPosition === "bottom" ? <PanelBottomOpen className="size-5.5 group-hover:scale-80 duration-150" /> : 
                            <RectangleStackOutline className="size-5.5 group-hover:scale-80 duration-150" />
                    }
                </button>
                <button className="group flex items-center justify-center opacity-80 hover:opacity-100 cursor-pointer duration-150"
                onClick={() => setOpenMenu(openMenu === "browser" ? "none" : "browser")}>
                    <EllipsisHorizontalIcon className="size-5.5 stroke-1 stroke-current group-hover:scale-80 duration-150" />
                </button>
                <ContextDialog open={openMenu === "browser"} options={browserOptions} />
            </div>
        </div>
    );
};