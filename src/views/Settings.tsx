import { PanelBottom, PanelLeft, PanelRight, PanelTop } from "lucide-react"
import { useSettingsStore } from "../libs/store"
import { useHistoryStore } from "../libs/store"

interface SettingsProps {
    className?: string
}

const TAB_POSITIONS: Array<"top" | "left" | "right" | "bottom"> = ["top", "left", "right", "bottom"]
const ACCENT_PRESETS = ["#f9ef81", "#6ec8ad", "#60a7dd", "#d85e6a", "#ffffff", "custom"]

const Settings = ({ className }: SettingsProps) => {
    const tabPosition = useSettingsStore(state => state.tabPosition)
    const persistTabs = useSettingsStore(state => state.persistTabs)
    const accent = useSettingsStore(state => state.accent)

    const setPersistTabs = useSettingsStore(state => state.setPersistTabs)
    const setTabPosition = useSettingsStore(state => state.setTabPosition)
    const setAccent = useSettingsStore(state => state.setAccent)

    const historyEntries = useHistoryStore(state => state.entries)
    const clearHistory = useHistoryStore(state => state.clearHistory)

    return (
        <div className={"flex flex-col size-full p-5 overflow-y-auto" + " " + (className ?? "") }>
            <div className="mx-auto w-full max-w-3xl space-y-4">
                <div className="rounded-2xl border border-white/12 bg-white/6 p-5">
                    <p className="text-2xl font-semibold">Settings</p>
                    <p className="text-sm opacity-70 mt-1">Customize your OmniTabs experience.</p>
                </div>

                <div className="rounded-2xl border border-white/12 bg-white/6 p-5 space-y-4">
                    <div>
                        <p className="text-sm font-semibold">Tab Layout</p>
                        <p className="text-xs opacity-65 mt-1">Choose where the tab strip appears.</p>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {TAB_POSITIONS.map((position) => (
                            <button
                                key={position}
                                className={"flex p-3 gap-2 items-center justify-center text-sm leading-none capitalize border rounded-lg duration-150" + " " +
                                    (tabPosition === position
                                        ? "bg-white/18 border-white/30"
                                        : "bg-white/5 border-white/12 hover:bg-white/10")}
                                onClick={() => setTabPosition(position)}
                            >
                                {
                                    position === 'top' ? <PanelTop className="size-4.5" /> :
                                    position === 'bottom' ? <PanelBottom className="size-4.5" /> :
                                    position === 'left' ? <PanelLeft className="size-4.5" /> :
                                    position === 'right' ? <PanelRight className="size-4.5" /> :
                                    null
                                }
                                {position}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="rounded-2xl border border-white/12 bg-white/6 p-5 space-y-4">
                    <div>
                        <p className="text-sm font-semibold">Session</p>
                        <p className="text-xs opacity-65 mt-1">Control how tab state is saved between launches.</p>
                    </div>

                    <label className="flex items-center justify-between gap-3 rounded-lg border border-white/12 bg-white/5 px-3 py-2.5 cursor-pointer">
                        <div>
                            <p className="text-sm font-medium">Persist Tabs</p>
                            <p className="text-xs opacity-65">Restore open tabs on next launch.</p>
                        </div>
                        <input
                            type="checkbox"
                            checked={persistTabs}
                            onChange={(e) => setPersistTabs(e.target.checked)}
                            className="size-4"
                        />
                    </label>
                </div>

                <div className="rounded-2xl border border-white/12 bg-white/6 p-5 space-y-4">
                    <div>
                        <p className="text-sm font-semibold">Appearance</p>
                        <p className="text-xs opacity-65 mt-1">Pick an accent preset.</p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {ACCENT_PRESETS.map((preset) => {

                            if (preset === "custom") {
                                return (
                                    <input
                                        type="color"
                                        value={
                                            "#" + Math.floor(Math.random() * 16777215).toString(16)
                                        }
                                        onChange={(e) => {
                                            const color = (e.target as HTMLInputElement).value;
                                            setAccent(color);
                                            document.documentElement.style.setProperty("--accent-color", color);
                                        }}
                                        className="rounded-lg border-0 outline-0 ring-0"
                                    />
                                );
                            } else {
                                return (
                                    <button
                                        key={preset}
                                        className={"h-8 rounded-full border-2 duration-150 " + (accent === preset ? "w-14 border-white scale-105" : "w-8 border-white/25 hover:border-white/50")}
                                        style={{ backgroundColor: preset }}
                                        onClick={() => setAccent(preset)}
                                        aria-label={`Set accent ${preset}`}
                                    />
                                );
                            }
                        })}
                    </div>
                </div>

                <div className="rounded-2xl border border-red-300/20 bg-red-400/8 p-5 space-y-3">
                    <div>
                        <p className="text-sm font-semibold text-red-200">Data</p>
                        <p className="text-xs text-red-100/75 mt-1">Manage local browsing data.</p>
                    </div>

                    <button
                        className="rounded-lg px-3 py-2 text-sm bg-red-400/20 hover:bg-red-400/30 text-red-100 duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
                        onClick={clearHistory}
                        disabled={historyEntries.length === 0}
                    >
                        Clear Browsing History ({historyEntries.length})
                    </button>
                </div>
            </div>
        </div>
    )
}

export default Settings