import * as icons from "lucide-static";

type IconProps = {
  className?: string;
  title?: string;
  "aria-hidden"?: boolean | "true" | "false";
};

function makeIcon(name: keyof typeof icons) {
  return function LucideIcon({
    className = "w-4 h-4",
    title,
    ...props
  }: IconProps) {
    const svg = String(icons[name])
      .replace("<svg", `<svg class="${className}"`)
      .replace('aria-hidden="true"', title ? `role="img"` : 'aria-hidden="true"');

    return (
      <span
        title={title}
        aria-hidden={props["aria-hidden"]}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    );
  };
}

export const AlertCircle = makeIcon("AlertCircle");
export const AlertTriangle = makeIcon("AlertTriangle");
export const ArrowRightLeft = makeIcon("ArrowRightLeft");
export const Check = makeIcon("Check");
export const ChevronLeft = makeIcon("ChevronLeft");
export const ChevronRight = makeIcon("ChevronRight");
export const Download = makeIcon("Download");
export const ExternalLink = makeIcon("ExternalLink");
export const Eye = makeIcon("Eye");
export const EyeOff = makeIcon("EyeOff");
export const FileSpreadsheet = makeIcon("FileSpreadsheet");
export const FileText = makeIcon("FileText");
export const FileType = makeIcon("FileType");
export const Folder = makeIcon("Folder");
export const FormInput = makeIcon("FormInput");
export const KeyRound = makeIcon("KeyRound");
export const Layers = makeIcon("Layers");
export const LayoutGrid = makeIcon("LayoutGrid");
export const ListOrdered = makeIcon("ListOrdered");
export const Loader2 = makeIcon("Loader2");
export const Maximize2 = makeIcon("Maximize2");
export const MessageSquare = makeIcon("MessageSquare");
export const Minimize2 = makeIcon("Minimize2");
export const Monitor = makeIcon("Monitor");
export const Palette = makeIcon("Palette");
export const PanelLeftClose = makeIcon("PanelLeftClose");
export const PanelLeftOpen = makeIcon("PanelLeftOpen");
export const Pencil = makeIcon("Pencil");
export const Plus = makeIcon("Plus");
export const RefreshCw = makeIcon("RefreshCw");
export const RotateCcw = makeIcon("RotateCcw");
export const Save = makeIcon("Save");
export const Send = makeIcon("Send");
export const Settings = makeIcon("Settings");
export const SlidersHorizontal = makeIcon("SlidersHorizontal");
export const Sparkles = makeIcon("Sparkles");
export const Square = makeIcon("Square");
export const Trash2 = makeIcon("Trash2");
export const Users = makeIcon("Users");
export const X = makeIcon("X");
export const Zap = makeIcon("Zap");
