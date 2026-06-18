import { useEffect, useState, type DragEvent } from 'react'
import { useTabStore, useSettingsStore, type Tab } from './libs/store'
import { XMarkIcon } from '@heroicons/react/16/solid'
import { ArrowPathRoundedSquareIcon, EllipsisHorizontalCircleIcon, GlobeAltIcon, PlusIcon } from '@heroicons/react/24/solid'
import { PageView } from './components/PageView'
import { UserCircleIcon } from '@heroicons/react/24/solid'
import { aboutPages, getPageFromUrl, INTERNAL_PROTOCOL } from './libs/aboutPages'
import { TopBar } from './components/TopBar'

const TabIcon = ({ tab }: { tab: Tab }) => {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [tab.url, tab.icon]);

  const pageName = getPageFromUrl(tab.url);
  if (pageName) {
    const pageConfig = pageName ? aboutPages[pageName] : undefined;
    if (pageConfig?.icon) {
      return <div className="size-5.5 flex items-center justify-center">{pageConfig.icon}</div>;
    }
  }

  if (tab.icon && !imgError) {
    return (
      <img
        src={tab.icon}
        className="size-5.5 rounded-sm object-contain"
        alt=""
        onError={() => setImgError(true)}
      />
    );
  }

  return <GlobeAltIcon className="size-5.5" />;
};

const toRgbTriplet = (hex: string) => {
  const clean = hex.replace('#', '').trim();
  const normalized = clean.length === 3
    ? clean.split('').map((char) => `${char}${char}`).join('')
    : clean;

  if (normalized.length !== 6) return '255 255 255';

  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);

  if ([r, g, b].some((value) => Number.isNaN(value))) {
    return '255 255 255';
  }

  return `${r} ${g} ${b}`;
};

const getAccentAlphaMultiplier = (hex: string) => {
  const clean = hex.replace('#', '').trim().toLowerCase();
  const normalized = clean.length === 3
    ? clean.split('').map((char) => `${char}${char}`).join('')
    : clean;

  if (normalized === 'ffffff' || normalized === '000000') {
    return 1;
  }

  return 1.65;
};

function App() {
  const { addTab, tabs, tabsOpen, setActive, moveTabRelative } = useTabStore()
  const { tabPosition, accent } = useSettingsStore()
  const isHorizontalTabs = tabPosition === 'top' || tabPosition === 'bottom'

  const [draggedTabId, setDraggedTabId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<{ id: string; placeBefore: boolean } | null>(null)

  const clearDragState = () => {
    setDraggedTabId(null)
    setDropTarget(null)
  }

  const handleDragStart = (event: DragEvent<HTMLDivElement>, tabId: string) => {
    setDraggedTabId(tabId)
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', tabId)
  }

  const handleDragOver = (event: DragEvent<HTMLDivElement>, targetId: string) => {
    if (!draggedTabId || draggedTabId === targetId) return

    event.preventDefault()

    const rect = event.currentTarget.getBoundingClientRect()
    const pointer = isHorizontalTabs ? event.clientX : event.clientY
    const midpoint = isHorizontalTabs ? rect.left + rect.width / 2 : rect.top + rect.height / 2
    const placeBefore = pointer < midpoint

    setDropTarget({ id: targetId, placeBefore })
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>, targetId: string) => {
    event.preventDefault()

    const sourceId = draggedTabId || event.dataTransfer.getData('text/plain')
    if (!sourceId || sourceId === targetId) {
      clearDragState()
      return
    }

    const placeBefore = dropTarget?.id === targetId ? dropTarget.placeBefore : true
    moveTabRelative(sourceId, targetId, placeBefore)
    clearDragState()
  }

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--accent', accent);
    root.style.setProperty('--accent-rgb', toRgbTriplet(accent));
    root.style.setProperty('--accent-alpha-multiplier', String(getAccentAlphaMultiplier(accent)));
  }, [accent]);

  return (
    <div className={"overflow-hidden" + " " + (tabPosition === 'top' ? 'flex-col' : tabPosition === 'bottom' ? 'flex-col-reverse' : tabPosition === 'left' ? 'flex-row' : 'flex-row-reverse') + " " + "p-2 gap-2 flex h-screen w-screen min-h-0 min-w-0"}>
      {
        tabsOpen === true && (
          <div className={"flex gap-2" + " " + (tabPosition === 'top' || tabPosition === 'bottom' ? 'flex-row items-center' : 'flex-col w-65 items-start')
          }>
            {
              tabPosition === "left" || tabPosition === "right" ? 
                <div className="flex w-full items-center justify-between py-3.5 px-4 leading-none">
                  <button className="opacity-80 hover:opacity-100 cursor-pointer duration-150">
                    <UserCircleIcon className="size-8" />
                  </button>
                  <button className="opacity-80 hover:opacity-100 cursor-pointer duration-150">
                    <ArrowPathRoundedSquareIcon className="size-8" />
                  </button>
                  <button className="opacity-80 hover:opacity-100 cursor-pointer duration-150">
                    <EllipsisHorizontalCircleIcon className="size-8" />
                  </button>
                </div> : null
            }
            <div className={"flex gap-2 h-min" + " " + (tabPosition === 'top' || tabPosition === 'bottom' ? 'flex-row overflow-x-auto' : 'flex-col w-65 overflow-y-auto')}>
              {
                tabs.map((tab) => (
                  <div
                  draggable
                  onDragStart={(event) => handleDragStart(event, tab.id)}
                  onDragOver={(event) => handleDragOver(event, tab.id)}
                  onDrop={(event) => handleDrop(event, tab.id)}
                  onDragEnd={clearDragState}
                  className={"relative flex gap-8 p-2 h-min items-center leading-none rounded-lg duration-150" + " " + (tabPosition === 'left' || tabPosition === 'right' ? 'justify-between' : 'justify-center') + " " +
                    (tab.active === true ? "accent-bg-10 hover:accent-bg-15 inset-shadow-transparent" : "accent-inset-1_5-12 hover:inset-shadow-transparent bg-white/0 hover:bg-white/8") + " " +
                    (draggedTabId === tab.id ? "opacity-60" : "")}
                    key={tab.id}
                  onClick={() => {
                    setActive(tab.id)
                  }}>
                    {dropTarget?.id === tab.id && draggedTabId !== tab.id && (
                      <div
                        className={
                          "absolute bg-white/70 rounded-full pointer-events-none " +
                          (isHorizontalTabs
                            ? (dropTarget.placeBefore ? "left-0 top-1 bottom-1 w-0.5" : "right-0 top-1 bottom-1 w-0.5")
                            : (dropTarget.placeBefore ? "top-0 left-1 right-1 h-0.5" : "bottom-0 left-1 right-1 h-0.5"))
                        }
                      />
                    )}
                    <div className="flex gap-1.5 items-center select-none">
                      <TabIcon tab={tab} />
                      <span className="text-md w-max">{tab.title}</span>
                    </div>
                    <XMarkIcon className="p-1 size-6 scale-125 hover:scale-100 hover:bg-white/6 rounded-md cursor-pointer duration-150" onMouseDown={() => {
                      useTabStore.getState().removeTab(tab.id)
                    }} />
                  </div>
                ))
              }
            </div>
            <button className={"group flex items-center justify-center p-2 rounded-lg text-white/40 hover:text-white accent-inset-1_5-18 hover:bg-white/10 hover:accent-inset-1_5-0 cursor-pointer duration-150" + " " +  
              (tabPosition === "left" || tabPosition === "right" ? "w-full" : "h-max")
            } onMouseDown={() => {
              addTab({
                title: 'New Tab',
                url: `${INTERNAL_PROTOCOL}newtab`,
              })
            }}>
              <PlusIcon className={"stroke-2 stroke-current group-hover:scale-110" + " " + `
                ${tabPosition === "left" || tabPosition === "right" ? "size-5" : "size-4"}
              `} />
            </button>
          </div>
        )
      }
      <div className="flex flex-col size-full gap-2 min-h-0 min-w-0">
        <TopBar />
        <PageView />
      </div>
    </div>
  )
}

export default App
