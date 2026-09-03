import * as Lucide from 'lucide-react';

/**
 * Thin adapter over lucide-react.
 *
 * The call signature is unchanged from the old hand-rolled path map —
 *   <Icon name="book-open" size={18} strokeWidth={2} />
 * — so no caller had to change when the implementation was swapped. Every
 * name below resolves to exactly one Lucide component; there is no emoji
 * iconography and no second icon library anywhere in the app.
 *
 * Sizing convention (design system §03): stroke 2 at 16–20px, stroke 1.75
 * at 24px and above. Icons inherit currentColor and never carry their own
 * colour except inside a tinted tile.
 */
const MAP = {
  /* --- brand / nav --- */
  'graduation-cap': Lucide.GraduationCap,
  'layout-dashboard': Lucide.LayoutDashboard,
  home: Lucide.House,
  grid: Lucide.Menu,
  menu: Lucide.Menu,
  target: Lucide.Target,
  'book-open': Lucide.BookOpen,
  book: Lucide.BookOpen,
  file: Lucide.FileText,
  'file-text': Lucide.FileText,
  edit: Lucide.PencilLine,
  pencil: Lucide.PencilLine,
  award: Lucide.ClipboardCheck /* tests manager */,
  'clipboard-check': Lucide.ClipboardCheck,
  chart: Lucide.ChartColumn,
  'chart-column': Lucide.ChartColumn,
  'trending-up': Lucide.TrendingUp,
  activity: Lucide.Activity,
  trophy: Lucide.Award /* rank */,
  flame: Lucide.Flame,
  bot: Lucide.Bot,
  settings: Lucide.Settings,
  'sliders-horizontal': Lucide.SlidersHorizontal,
  'shield-check': Lucide.ShieldCheck,
  shield: Lucide.ShieldCheck,
  history: Lucide.History,
  clock: Lucide.Clock,
  bell: Lucide.Bell,
  search: Lucide.Search,
  'building-2': Lucide.Building2,
  server: Lucide.Server,

  /* --- actions --- */
  plus: Lucide.Plus,
  check: Lucide.Check,
  x: Lucide.X,
  alert: Lucide.CircleAlert,
  'circle-alert': Lucide.CircleAlert,
  'check-circle': Lucide.CircleCheckBig,
  'circle-check-big': Lucide.CircleCheckBig,
  download: Lucide.Download,
  upload: Lucide.Upload,
  trash: Lucide.Trash2,
  'trash-2': Lucide.Trash2,
  ellipsis: Lucide.Ellipsis,
  refresh: Lucide.RefreshCw,
  play: Lucide.Play,
  send: Lucide.Send,
  filter: Lucide.SlidersHorizontal,

  /* --- people / access --- */
  user: Lucide.Users,
  users: Lucide.Users,
  'user-round': Lucide.UserRound,
  key: Lucide.KeyRound,
  lock: Lucide.Lock,
  zap: Lucide.UserPlus,
  'user-plus': Lucide.UserPlus,
  'log-out': Lucide.LogOut,
  mail: Lucide.Mail,
  phone: Lucide.Phone,

  /* --- commerce / study --- */
  'shopping-bag': Lucide.CreditCard,
  'credit-card': Lucide.CreditCard,
  languages: Lucide.Languages,
  bookmark: Lucide.Bookmark,
  mic: Lucide.Mic,
  star: Lucide.Star,
  sparkles: Lucide.Sparkles,

  /* --- chrome --- */
  sun: Lucide.Sun,
  moon: Lucide.Moon,
  'arrow-right': Lucide.ArrowRight,
  'arrow-left': Lucide.ArrowLeft,
  'chevron-right': Lucide.ChevronRight,
  'chevron-left': Lucide.ChevronLeft,
  'chevron-down': Lucide.ChevronDown,
  chevronRight: Lucide.ChevronRight,
  chevronLeft: Lucide.ChevronLeft,
  'external-link': Lucide.ExternalLink,
  'help-circle': Lucide.CircleHelp,
  'circle-help': Lucide.CircleHelp,
  smartphone: Lucide.Smartphone,
  tablet: Lucide.Tablet,
  monitor: Lucide.Monitor,
  image: Lucide.Image,
  eye: Lucide.Eye,
  'eye-off': Lucide.EyeOff,
  calendar: Lucide.Calendar,
  info: Lucide.Info,
};

const warned = new Set();

export default function Icon({ name, size = 20, strokeWidth, style, ...rest }) {
  const Glyph = MAP[name];
  if (!Glyph) {
    if (!warned.has(name)) {
      warned.add(name);
      console.warn(`[Icon] unknown name "${name}" — nothing rendered.`);
    }
    return null;
  }
  return (
    <Glyph
      size={size}
      strokeWidth={strokeWidth ?? (size >= 24 ? 1.75 : 2)}
      aria-hidden="true"
      style={{ flexShrink: 0, ...style }}
      {...rest}
    />
  );
}
