import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import { INTERNAL_PROTOCOL, aboutPages } from './aboutPages'

export interface Tab {
    index?: number
    id: string
    title: string
    url: string
    icon?: string
    groupId: string | null
    createdAt: number
    data?: Record<string, unknown>
    active: boolean
    history?: HistoryEntry[]
    historyIndex?: number
    refreshKey?: number
}

export type HistoryEntry = {
    url: string
    title: string
    icon?: string
}

export type BrowserHistoryEntry = {
    id: string
    url: string
    title: string
    icon?: string
    visitedAt: number
}

export type BookmarkEntry = {
    id: string
    url: string
    title: string
    icon?: string
    createdAt: number
}

export type OmniboxSuggestion = {
    id: string
    label: string
    value: string
    subtitle?: string
    kind: 'navigate' | 'internal' | 'tab' | 'search'
}

export type TabGroup = {
    id: string
    name: string
    tabIds: string[]
    createdAt: number
}

type TabDraft = {
    title?: string
    url?: string
    icon?: string
    groupId?: string | null
    data?: Record<string, unknown>
}

type TabStore = {
    tabs: Tab[]
    groups: TabGroup[]
    activationHistory: string[]
    isDialogOpen: boolean
    setDialogOpen: (open: boolean) => void
    moveTabRelative: (draggedId: string, targetId: string, placeBefore: boolean) => void;
    addTab: (draft: TabDraft) => Tab
    removeTab: (tabId: string) => void
    updateTab: (tabId: string, updates: Partial<Omit<Tab, 'id' | 'createdAt'>>) => void
    createGroup: (name: string, tabIds?: string[]) => TabGroup
    removeGroup: (groupId: string) => void
    addToGroup: (groupId: string, tabId: string) => void
    removeFromGroup: (tabId: string) => void
    moveTabToGroup: (tabId: string, groupId: string) => void
    getGroupTabs: (groupId: string) => Tab[]
    setHistory: (id: string, history: HistoryEntry[]) => void;
    getHistoryIndex: (id: string) => number;
	setHistoryIndex: (id: string, index: number) => void;
	pushHistory: (id: string, entry: HistoryEntry) => void;
    navigateBack: (id: string) => void
    navigateForward: (id: string) => void
    tabsOpen: boolean
    omniboxOpen: boolean
    omniboxSuggestions: OmniboxSuggestion[]
    omniboxSelectedIndex: number
    setOmniboxOpen: (open: boolean) => void
    setOmniboxSuggestions: (suggestions: OmniboxSuggestion[]) => void
    setOmniboxSelectedIndex: (index: number) => void
    setTabState: (panelState: boolean) => void
    clearAll: () => void
    setActive: (tabId: string) => void
}

type BrowserHistoryStore = {
    entries: BrowserHistoryEntry[]
    recordVisit: (entry: Omit<BrowserHistoryEntry, 'id' | 'visitedAt'> & { visitedAt?: number }) => void
    updateLatestForUrl: (url: string, updates: { title?: string; icon?: string }) => void
    removeEntry: (id: string) => void
    clearHistory: () => void
}

type BookmarkStore = {
    entries: BookmarkEntry[]
    addBookmark: (entry: Omit<BookmarkEntry, 'id' | 'createdAt'> & { createdAt?: number }) => void
    removeBookmark: (url: string) => void
    toggleBookmark: (entry: Omit<BookmarkEntry, 'id' | 'createdAt'>) => void
    clearBookmarks: () => void
    isBookmarked: (url: string) => boolean
}

const MAX_HISTORY_ENTRIES = 1500
const TABS_STORE_NAME = 'omnitabs-tab-store'
const SETTINGS_STORE_NAME = 'omnitabs-settings-store'
const BOOKMARKS_STORE_NAME = 'omnitabs-bookmarks-store'

const getFallbackTitleAndIcon = (url: string) => {
    if (!url) return { title: "New Tab", icon: undefined };

    let targetUrl = url;
    if (url.startsWith("/service/")) {
        const encodedPart = url.slice(9);
        try {
            targetUrl = decodeURIComponent(encodedPart);
        } catch {
            targetUrl = encodedPart;
        }
    }

    if (targetUrl.startsWith(INTERNAL_PROTOCOL) || targetUrl.startsWith("about:")) {
        const pageName = targetUrl.startsWith(INTERNAL_PROTOCOL)
            ? targetUrl.slice(INTERNAL_PROTOCOL.length).split("?")[0]
            : targetUrl.slice(6).split("?")[0];
        const formattedTitle = pageName === "newtab"
            ? "New Tab"
            : pageName.charAt(0).toUpperCase() + pageName.slice(1);
        const registryTitle = aboutPages[pageName]?.title;
        return { title: registryTitle || formattedTitle, icon: undefined };
    }

    // Try parsing as standard URL
    let absoluteUrl = targetUrl;
    if (!/^https?:\/\//i.test(targetUrl)) {
        absoluteUrl = `https://${targetUrl}`;
    }

    try {
        const urlObj = new URL(absoluteUrl);
        const hostname = urlObj.hostname.replace(/^www\./i, "");
        const parts = hostname.split(".");
        let title = parts[0] || "Webpage";
        if (title.toLowerCase() === "google" && urlObj.pathname.includes("/search")) {
            const searchParams = new URLSearchParams(urlObj.search);
            const q = searchParams.get("q");
            if (q) {
                title = `${q} - Google Search`;
            } else {
                title = "Google Search";
            }
        } else {
            title = title.charAt(0).toUpperCase() + title.slice(1);
        }
        const icon = `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`;
        return { title, icon };
    } catch {
        return { title: "Webpage", icon: undefined };
    }
}

const createId = () => {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return crypto.randomUUID()
    }

    return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

const shouldTrackGlobalHistory = (url: string) => {
    if (!url) return false
    if (url.startsWith(INTERNAL_PROTOCOL) || url.startsWith('about:')) return false
    return true
}

const canBookmarkUrl = (url: string) => {
    if (!url) return false
    if (url.startsWith(INTERNAL_PROTOCOL) || url.startsWith('about:')) return false
    return true
}

const isTabPersistenceEnabled = () => {
    if (typeof window === 'undefined') return true

    try {
        const settingsRaw = window.localStorage.getItem(SETTINGS_STORE_NAME)
        if (!settingsRaw) return true

        const parsed = JSON.parse(settingsRaw) as { state?: { persistTabs?: boolean } }
        if (typeof parsed?.state?.persistTabs === 'boolean') {
            return parsed.state.persistTabs
        }

        return true
    } catch {
        return true
    }
}

const conditionalTabsStorage: StateStorage = {
    getItem: (name) => {
        if (typeof window === 'undefined') return null
        if (!isTabPersistenceEnabled()) return null
        return window.localStorage.getItem(name)
    },
    setItem: (name, value) => {
        if (typeof window === 'undefined') return
        if (!isTabPersistenceEnabled()) {
            window.localStorage.removeItem(name)
            return
        }
        window.localStorage.setItem(name, value)
    },
    removeItem: (name) => {
        if (typeof window === 'undefined') return
        window.localStorage.removeItem(name)
    },
}

export const useHistoryStore = create<BrowserHistoryStore>()(
    persist(
        (set) => ({
            entries: [],

            recordVisit: (entry) => {
                set((state) => {
                    const nextEntry: BrowserHistoryEntry = {
                        id: createId(),
                        url: entry.url,
                        title: entry.title,
                        icon: entry.icon,
                        visitedAt: entry.visitedAt ?? Date.now(),
                    }

                    return {
                        entries: [nextEntry, ...state.entries].slice(0, MAX_HISTORY_ENTRIES),
                    }
                })
            },

            updateLatestForUrl: (url, updates) => {
                set((state) => {
                    const index = state.entries.findIndex((entry) => entry.url === url)
                    if (index === -1) return state

                    const nextEntries = [...state.entries]
                    nextEntries[index] = {
                        ...nextEntries[index],
                        title: updates.title ?? nextEntries[index].title,
                        icon: updates.icon ?? nextEntries[index].icon,
                    }

                    return { entries: nextEntries }
                })
            },

            removeEntry: (id) => {
                set((state) => ({
                    entries: state.entries.filter((entry) => entry.id !== id),
                }))
            },

            clearHistory: () => {
                set({ entries: [] })
            },
        }),
        {
            name: 'omnitabs-browsing-history-store',
            version: 2,
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({ entries: state.entries }),
            migrate: (persistedState) => {
                const state = persistedState as { entries?: BrowserHistoryEntry[] };
                return {
                    ...state,
                    entries: (state.entries ?? []).filter((entry) => shouldTrackGlobalHistory(entry.url)),
                };
            },
        },
    ),
)

export const useBookmarkStore = create<BookmarkStore>()(
    persist(
        (set, get) => ({
            entries: [],

            addBookmark: (entry) => {
                if (!canBookmarkUrl(entry.url)) return

                set((state) => {
                    if (state.entries.some((item) => item.url === entry.url)) {
                        return state
                    }

                    const nextEntry: BookmarkEntry = {
                        id: createId(),
                        url: entry.url,
                        title: entry.title,
                        icon: entry.icon,
                        createdAt: entry.createdAt ?? Date.now(),
                    }

                    return {
                        entries: [nextEntry, ...state.entries],
                    }
                })
            },

            removeBookmark: (url) => {
                set((state) => ({
                    entries: state.entries.filter((entry) => entry.url !== url),
                }))
            },

            toggleBookmark: (entry) => {
                if (!canBookmarkUrl(entry.url)) return

                const exists = get().entries.some((item) => item.url === entry.url)
                if (exists) {
                    get().removeBookmark(entry.url)
                    return
                }

                get().addBookmark(entry)
            },

            clearBookmarks: () => {
                set({ entries: [] })
            },

            isBookmarked: (url) => {
                if (!url) return false
                return get().entries.some((entry) => entry.url === url)
            },
        }),
        {
            name: BOOKMARKS_STORE_NAME,
            version: 1,
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({ entries: state.entries }),
            migrate: (persistedState) => {
                const state = persistedState as { entries?: BookmarkEntry[] }
                return {
                    ...state,
                    entries: (state.entries ?? []).filter((entry) => canBookmarkUrl(entry.url)),
                }
            },
        },
    ),
)

export const useTabStore = create<TabStore>()(
    persist(
        (set, get) => ({
            tabs: [],
            groups: [],
            activationHistory: [],
            tabsOpen: true,
            omniboxOpen: false,
            omniboxSuggestions: [],
            omniboxSelectedIndex: -1,
            isDialogOpen: false,

            setDialogOpen: (open) =>
                set(() => ({
                    isDialogOpen: open,
                })),

            setTabState: (ps) => 
                set(() => {
                    return {
                        tabsOpen: ps
                    }
                }),

            setOmniboxOpen: (open) =>
                set(() => ({
                    omniboxOpen: open,
                })),

            setOmniboxSuggestions: (suggestions) =>
                set(() => ({
                    omniboxSuggestions: suggestions,
                })),

            setOmniboxSelectedIndex: (index) =>
                set(() => ({
                    omniboxSelectedIndex: index,
                })),

            addTab: (draft) => {
                const url = draft.url ?? `${INTERNAL_PROTOCOL}newtab`;
                const fallback = getFallbackTitleAndIcon(url);
                const title = draft.title || fallback.title;
                const icon = draft.icon || fallback.icon;
                const tab: Tab = {
                    id: createId(),
                    title,
                    url,
                    icon,
                    groupId: draft.groupId ?? null,
                    createdAt: Date.now(),
                    data: draft.data ?? {},
                    active: true,
                    history: [
                        {
                            url,
                            title,
                            icon,
                        },
                    ],
                    historyIndex: 0,
                }

                if (shouldTrackGlobalHistory(url)) {
                    useHistoryStore.getState().recordVisit({
                        url,
                        title,
                        icon,
                    })
                }

                set((state) => {
                    const nextGroups = tab.groupId
                        ? state.groups.map((group) =>
                            group.id === tab.groupId
                                ? { ...group, tabIds: group.tabIds.includes(tab.id) ? group.tabIds : [...group.tabIds, tab.id] }
                                : group,
                        )
                        : state.groups

                    var activeTabs = state.tabs.filter((t) => t.active)
                    activeTabs.forEach((tab) => {
                        tab.active = false
                    })

                    return {
                        tabs: [...state.tabs, tab],
                        groups: nextGroups,
                        activationHistory: [...state.activationHistory.filter((id) => id !== tab.id), tab.id],
                    }
                })

                return get().tabs.find((item) => item.id === tab.id) ?? tab
            },

            removeTab: (tabId) => {
                set((state) => {
                    const removedTab = state.tabs.find((tab) => tab.id === tabId)
                    const removedIndex = state.tabs.findIndex((tab) => tab.id === tabId)
                    let nextTabs = state.tabs.filter((tab) => tab.id !== tabId)
                    const nextGroups = state.groups.map((group) => ({
                        ...group,
                        tabIds: group.tabIds.filter((id) => id !== tabId),
                    }))
                    let nextActivationHistory = state.activationHistory.filter((id) => id !== tabId)

                    if (removedTab?.active && nextTabs.length > 0) {
                        let nextActiveId = [...nextActivationHistory]
                            .reverse()
                            .find((id) => nextTabs.some((tab) => tab.id === id))

                        if (!nextActiveId) {
                            const fallbackIndex = removedIndex >= nextTabs.length ? nextTabs.length - 1 : removedIndex
                            nextActiveId = nextTabs[fallbackIndex]?.id
                        }

                        nextTabs = nextTabs.map((tab) => ({
                            ...tab,
                            active: tab.id === nextActiveId,
                        }))

                        if (nextActiveId) {
                            nextActivationHistory = [
                                ...nextActivationHistory.filter((id) => id !== nextActiveId),
                                nextActiveId,
                            ]
                        }
                    }

                    return {
                        tabs: nextTabs,
                        groups: nextGroups,
                        activationHistory: nextActivationHistory,
                    }
                })
            },

            updateTab: (tabId, updates) => {
                set((state) => ({
                    tabs: state.tabs.map((tab) => {
                        if (tab.id === tabId) {
                            let merged = { ...tab, ...updates };
                            let nextHistory = tab.history ?? [{ url: tab.url, title: tab.title, icon: tab.icon }];
                            let nextHistoryIndex = typeof tab.historyIndex === "number" ? tab.historyIndex : nextHistory.length - 1;

                            if (updates.url && updates.url !== tab.url) {
                                const fallback = getFallbackTitleAndIcon(updates.url);
                                if (!updates.title) {
                                    merged.title = fallback.title;
                                }
                                if (!updates.icon) {
                                    merged.icon = fallback.icon;
                                }

                                const entry: HistoryEntry = {
                                    url: merged.url,
                                    title: merged.title,
                                    icon: merged.icon,
                                };

                                if (shouldTrackGlobalHistory(entry.url)) {
                                    useHistoryStore.getState().recordVisit({
                                        url: entry.url,
                                        title: entry.title,
                                        icon: entry.icon,
                                    })
                                }

                                nextHistory = [...nextHistory.slice(0, nextHistoryIndex + 1), entry];
                                nextHistoryIndex = nextHistory.length - 1;
                            } else if (updates.title || updates.icon) {
                                if (shouldTrackGlobalHistory(tab.url)) {
                                    useHistoryStore.getState().updateLatestForUrl(tab.url, {
                                        title: merged.title,
                                        icon: merged.icon,
                                    })
                                }

                                if (nextHistory[nextHistoryIndex]) {
                                    nextHistory = nextHistory.map((entry, index) =>
                                        index === nextHistoryIndex
                                            ? {
                                                ...entry,
                                                title: merged.title,
                                                icon: merged.icon,
                                            }
                                            : entry,
                                    );
                                }
                            }

                            return {
                                ...merged,
                                history: nextHistory,
                                historyIndex: nextHistoryIndex,
                            };
                        }
                        return tab;
                    }),
                }))
            },

            createGroup: (name, tabIds = []) => {
                const group: TabGroup = {
                    id: createId(),
                    name,
                    tabIds,
                    createdAt: Date.now(),
                }

                set((state) => ({
                    groups: [...state.groups, group],
                }))

                return group
            },

            removeGroup: (groupId) => {
                set((state) => ({
                    tabs: state.tabs.map((tab) => (tab.groupId === groupId ? { ...tab, groupId: null } : tab)),
                    groups: state.groups.filter((group) => group.id !== groupId),
                }))
            },

            addToGroup: (groupId, tabId) => {
                set((state) => {
                    const targetTab = state.tabs.find((tab) => tab.id === tabId)
                    const targetGroup = state.groups.find((group) => group.id === groupId)

                    if (!targetTab || !targetGroup) {
                        return state
                    }

                    return {
                        tabs: state.tabs.map((tab) => (tab.id === tabId ? { ...tab, groupId } : tab)),
                        groups: state.groups.map((group) =>
                            group.id === groupId
                                ? { ...group, tabIds: group.tabIds.includes(tabId) ? group.tabIds : [...group.tabIds, tabId] }
                                : group,
                        ),
                    }
                })
            },

            removeFromGroup: (tabId) => {
                set((state) => ({
                    tabs: state.tabs.map((tab) => (tab.id === tabId ? { ...tab, groupId: null } : tab)),
                    groups: state.groups.map((group) => ({
                        ...group,
                        tabIds: group.tabIds.filter((id) => id !== tabId),
                    })),
                }))
            },

            moveTabToGroup: (tabId, groupId) => {
                get().addToGroup(groupId, tabId)
            },

            getGroupTabs: (groupId) => get().tabs.filter((tab) => tab.groupId === groupId),

            getHistory: (id: string) => {
                const tab = get().tabs.find(t => t.id === id);
                return (tab as any)?.history ?? null;
            },

            setHistory: (id: string, history: { url: string; title: string; icon?: string; }[]) => {
                set(state => ({
                    tabs: state.tabs.map(tab => (
                        tab.id === id
                            ? ({ ...tab, history, historyIndex: history.length > 0 ? Math.min(tab.historyIndex ?? 0, history.length - 1) : 0 } as Tab)
                            : tab
                    )),
                }));
            },

            getHistoryIndex: (id: string) => {
                const tab = get().tabs.find(t => t.id === id);
                return tab?.historyIndex ?? 0;
            },

            setHistoryIndex: (id: string, index: number) => {
                set(state => ({
                    tabs: state.tabs.map(tab => (tab.id === id ? ({ ...tab, historyIndex: index } as Tab) : tab)),
                }));
            },

            pushHistory: (id: string, entry: HistoryEntry) => {
                const tab = get().tabs.find(t => t.id === id);
                if (!tab) return;

                const currentHistory = tab.history ?? [];
                const currentIndex = tab.historyIndex ?? 0;

                const newHistory = [...currentHistory.slice(0, currentIndex + 1), entry];
                const newIndex = newHistory.length - 1;

                set(state => ({
                    tabs: state.tabs.map(t => (t.id === id ? ({ ...t, history: newHistory, historyIndex: newIndex } as Tab) : t)),
                }));
            },

            navigateBack: (id: string) => {
                set((state) => ({
                    tabs: state.tabs.map((tab) => {
                        if (tab.id !== id) return tab;

                        const history = tab.history ?? [];
                        const currentIndex = tab.historyIndex ?? 0;
                        const nextIndex = currentIndex - 1;
                        if (nextIndex < 0 || !history[nextIndex]) return tab;

                        const entry = history[nextIndex];
                        return {
                            ...tab,
                            url: entry.url,
                            title: entry.title,
                            icon: entry.icon,
                            historyIndex: nextIndex,
                        };
                    }),
                }));
            },

            navigateForward: (id: string) => {
                set((state) => ({
                    tabs: state.tabs.map((tab) => {
                        if (tab.id !== id) return tab;

                        const history = tab.history ?? [];
                        const currentIndex = tab.historyIndex ?? 0;
                        const nextIndex = currentIndex + 1;
                        if (nextIndex >= history.length || !history[nextIndex]) return tab;

                        const entry = history[nextIndex];
                        return {
                            ...tab,
                            url: entry.url,
                            title: entry.title,
                            icon: entry.icon,
                            historyIndex: nextIndex,
                        };
                    }),
                }));
            },

            moveTabRelative: (draggedId: string, targetId: string, placeBefore: boolean) =>
                set(state => {
                    const tabs = [...state.tabs];
                    const from = tabs.findIndex(t => t.id === draggedId);
                    if (from === -1) return state;

                    let to = tabs.findIndex(t => t.id === targetId);
                    if (to === -1) return state;

                    if (from === to) return state;

                    const item = tabs.splice(from, 1)[0];

                    to = tabs.findIndex(t => t.id === targetId);
                    if (!placeBefore) to = to + 1;

                    tabs.splice(to, 0, item);
                    return { tabs };
                }),

            clearAll: () => {
                set({ tabs: [], groups: [], activationHistory: []})
            },

            setActive: (tabId: string) => {
                set(state => ({
                    tabs: state.tabs.map((tab) => ({
                        ...tab,
                        active: tab.id === tabId,
                    })),
                    activationHistory: [...state.activationHistory.filter((id) => id !== tabId), tabId],
                }))
            }
        }),
        {
            name: TABS_STORE_NAME,
            storage: createJSONStorage(() => conditionalTabsStorage),
            partialize: (state) => ({ tabs: state.tabs, groups: state.groups, tabsOpen: state.tabsOpen, activationHistory: state.activationHistory }),
        },
    ),
)

type SettingsStore = {
    theme: 'light' | 'dark'
    tabPosition: 'top' | 'bottom' | 'left' | 'right'
    setTabPosition: (position: 'top' | 'bottom' | 'left' | 'right') => void
    persistTabs: boolean
    setPersistTabs: (persistTabs: boolean) => void
    accent: string
    setAccent: (accent: string) => void
}

export const useSettingsStore = create<SettingsStore>()(
    persist(
        (set) => ({
            theme: 'dark',
            tabPosition: 'top',
            setTabPosition: (position) => set({ tabPosition: position }),
            persistTabs: true,
            setPersistTabs: (persistTabs) => {
                set({ persistTabs })

                if (typeof window === 'undefined') return

                if (!persistTabs) {
                    window.localStorage.removeItem(TABS_STORE_NAME)
                    return
                }

                const tabState = useTabStore.getState()
                const persistedTabState = {
                    tabs: tabState.tabs,
                    groups: tabState.groups,
                    tabsOpen: tabState.tabsOpen,
                    activationHistory: tabState.activationHistory,
                }

                window.localStorage.setItem(
                    TABS_STORE_NAME,
                    JSON.stringify({
                        state: persistedTabState,
                        version: 0,
                    }),
                )
            },
            accent: "#ffffff",
            subAccents: {
                primary: "#ffffff"
            },
            setAccent: (accent) => {
                set(state => {
                    if (state.accent === accent) {
                        return state
                    }

                    return { accent }
                })
            }
        }),
        {
            name: SETTINGS_STORE_NAME,
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({ theme: state.theme, tabPosition: state.tabPosition, persistTabs: state.persistTabs, accent: state.accent }),
        },
    ),
)