import { CheckCircleIcon } from "@heroicons/react/24/outline"
import { useState, useRef } from "react";
import { useTabStore } from "../libs/store"
import { INTERNAL_PROTOCOL } from "../libs/aboutPages";

interface HomeProps {
    className?: string
}

const resolveUrl = (input: string) => {
    if (!input) return `${INTERNAL_PROTOCOL}newtab`;
    if (input.startsWith(INTERNAL_PROTOCOL)) return input;
    if (input.startsWith("about:")) return `${INTERNAL_PROTOCOL}${input.slice(6)}`;
    if (input.startsWith("/") || input.startsWith("./") || input.startsWith("../")) return input;

    if (input.startsWith("/service/")) {
        return input;
    }

    let formatted = input.trim();
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

    if (typeof window !== "undefined" && (window as any).scramjet?.encodeUrl) {
        try {
            return (window as any).scramjet.encodeUrl(formatted);
        } catch (e) {
            console.error("Failed to scramjet encode:", e);
        }
    }

    return formatted;
};

const Home = ({ className }: HomeProps) => {
    const [hasQuery, setHasQuery] = useState<boolean>(false)
    const inputRef = useRef<HTMLInputElement>(null)
    const activeTab = useTabStore(state => state.tabs.find(t => t.active));
    const updateTab = useTabStore(state => state.updateTab)

    const handleNavigate = () => {
        const val = inputRef.current?.value;
        if (val && activeTab) {
            updateTab(activeTab.id, {
                url: resolveUrl(val)
            });
        }
    };

    return (
        <div className={"flex flex-col items-center justify-center size-full p-2" + " " + className}>
            <div className="flex flex-col h-full items-center justify-center gap-4">
				<span className="text-8xl font-black text-center text-accent text-stroke">OmniTabs</span>
                <div className="relative flex items-center p-4.5 px-5.5 min-w-90 accent-inset-2-10 rounded-full">
                    <span className={
							"absolute left-5.5 text-lg font-semibold ease-in-out pointer-events-none w-max" +
							" " +
							`
                        ${hasQuery ? "opacity-0 -translate-x-1 duration-100" : "duration-150"}`}>Search or enter URL</span>
                    <input ref={inputRef} type="text" className="size-full text-(--text-secondary) font-medium focus:outline-none focus:ring-0 z-10" onChange={(e) => {
                        const value = (e.target as HTMLInputElement).value;
                        if (value !== "") {
                            setHasQuery(true)
                        } else {
                            setHasQuery(false)
                        }
                    }} onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            handleNavigate();
                        }
                    }} />
                    <button onClick={handleNavigate} className="opacity-60 hover:opacity-100 accent-inset-2-8 hover:accent-inset-2-28 rounded-full cursor-pointer duration-150">
                        <CheckCircleIcon className="size-6 stroke-white/50" />
                    </button>
                </div>
			</div>
        </div>
    )
}

export default Home