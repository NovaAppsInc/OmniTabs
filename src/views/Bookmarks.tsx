import { BookmarkIcon, Trash2Icon } from "lucide-react";
import { useBookmarkStore, useTabStore } from "../libs/store";

const getDisplayDomain = (url: string) => {
    try {
        const parsed = new URL(url);
        return parsed.hostname.replace(/^www\./i, "");
    } catch {
        return url;
    }
};

export const Bookmarks = () => {
    const entries = useBookmarkStore((state) => state.entries);
    const removeBookmark = useBookmarkStore((state) => state.removeBookmark);
    const clearBookmarks = useBookmarkStore((state) => state.clearBookmarks);

    const activeTab = useTabStore((state) => state.tabs.find((tab) => tab.active));
    const updateTab = useTabStore((state) => state.updateTab);
    const addTab = useTabStore((state) => state.addTab);

    const openEntry = (entry: { url: string; title: string; icon?: string }) => {
        if (activeTab) {
            updateTab(activeTab.id, {
                url: entry.url,
                title: entry.title,
                icon: entry.icon,
            });
            return;
        }

        addTab({
            url: entry.url,
            title: entry.title,
            icon: entry.icon,
        });
    };

    return (
        <div className="flex flex-col size-full p-6 gap-5 overflow-y-auto">
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <BookmarkIcon className="size-5" />
                    <h1 className="text-xl font-semibold">Bookmarks</h1>
                </div>
                <button
                    className="text-sm px-3 py-2 rounded-md bg-white/10 hover:bg-white/15 duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
                    onClick={clearBookmarks}
                    disabled={entries.length === 0}
                >
                    Clear Bookmarks
                </button>
            </div>

            {entries.length === 0 ? (
                <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm opacity-75">
                    No bookmarks saved yet.
                </div>
            ) : (
                <div className="flex flex-col gap-2">
                    {entries.map((entry) => (
                        <div
                            key={entry.id}
                            className="group flex items-center justify-between gap-4 p-3 rounded-lg border border-white/8 bg-white/4 hover:bg-white/7 duration-150"
                        >
                            <button
                                className="flex-1 min-w-0 text-left cursor-pointer"
                                onClick={() => openEntry(entry)}
                            >
                                <p className="text-sm font-medium truncate">{entry.title || getDisplayDomain(entry.url)}</p>
                                <p className="text-xs opacity-65 truncate">{getDisplayDomain(entry.url)}</p>
                                <p className="text-xs opacity-50 mt-1">Saved {new Date(entry.createdAt).toLocaleString()}</p>
                            </button>

                            <button
                                className="p-2 rounded-md opacity-70 hover:opacity-100 hover:bg-red-400/20 text-red-200 duration-150"
                                onClick={() => removeBookmark(entry.url)}
                                aria-label="Remove bookmark"
                            >
                                <Trash2Icon className="size-4.5" />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}