import { useEffect, useState, type ReactNode } from "react";

const DIALOG_ANIMATION_MS = 140;

type ActionOption = {
    label: string;
    onSelect: () => void;
    danger?: boolean;
    icon?: ReactNode;
    dividerBefore?: boolean;
    dividerAfter?: boolean;
};

type DividerOption = {
    type: "divider";
    key?: string;
};

export type DialogOption = ActionOption | DividerOption;

const isDividerOption = (option: DialogOption): option is DividerOption =>
    "type" in option && option.type === "divider";

type ContextDialogProps = {
    open: boolean;
    title?: string;
    subtitle?: string;
    widthClass?: string;
    options?: DialogOption[];
    customContent?: ReactNode;
};

export const ContextDialog = ({
    open,
    title,
    subtitle,
    widthClass = "w-50",
    options,
    customContent,
}: ContextDialogProps) => {
    const [isMounted, setIsMounted] = useState(open);

    useEffect(() => {
        if (open) {
            setIsMounted(true);
            return;
        }

        const timeoutId = window.setTimeout(() => {
            setIsMounted(false);
        }, DIALOG_ANIMATION_MS);

        return () => {
            window.clearTimeout(timeoutId);
        };
    }, [open]);

    if (!isMounted) return null;

    return (
        <div className={`absolute top-[calc(100%+0.3rem)] right-0 rounded-xl border border-(--accent)/15 bg-(--accent)/10 backdrop-blur-md shadow-2xl z-40 overflow-hidden origin-top ${open ? "animate-context-dialog-in" : "animate-context-dialog-out"} ${widthClass}`}>
            {(title || subtitle) && (
                <div className="p-4 border-b border-(--accent)/15 bg-(--accent)/10">
                    {title && <p className="text-sm font-semibold leading-none">{title}</p>}
                    {subtitle && <p className="text-xs opacity-70 mt-1">{subtitle}</p>}
                </div>
            )}

            {customContent ? (
                customContent
            ) : (
                <>
                    {options?.map((option, index) => {
                        if (isDividerOption(option)) {
                            return <div key={option.key ?? `divider-${index}`} className="h-0.5 bg-(--accent)/10" role="separator" />;
                        }

                        return (
                            <>
                                {option.dividerBefore ? <div className="h-0.5 bg-(--accent)/10" role="separator" /> : null}
                                <button
                                    className={
                                        "flex items-center justify-between gap-2 w-full text-left text-sm font-medium px-3 py-2 first:rounded-t-md last:rounded-b-md cursor-pointer duration-150" + " " +
                                        (option.danger
                                            ? "text-red-300 hover:bg-red-400/20"
                                            : "hover:bg-(--accent)/10")
                                    }
                                    onClick={option.onSelect}
                                >
                                    <span>{option.label}</span>
                                    {option.icon ? <span className="opacity-90">{option.icon}</span> : null}
                                </button>
                                {option.dividerAfter ? <div className="h-0.5 bg-(--accent)/10" role="separator" /> : null}
                            </>
                        );
                    })}
                </>
            )}
        </div>
    );
};
