import {
  Apple,
  Baby,
  Beef,
  Bike,
  Bone,
  BookOpen,
  Cake,
  CakeSlice,
  Candy,
  CarFront,
  Carrot,
  Cherry,
  Cigarette,
  Coffee,
  Croissant,
  CupSoda,
  Droplets,
  Drumstick,
  Dumbbell,
  Egg,
  Fish,
  Flame,
  Flower2,
  Glasses,
  Gift,
  Grape,
  Hammer,
  HeartPulse,
  House,
  IceCreamCone,
  Laptop,
  Leaf,
  Milk,
  Moon,
  Music,
  Package,
  Palette,
  PawPrint,
  Pill,
  Pizza,
  Salad,
  Sandwich,
  Scissors,
  Shirt,
  ShoppingBasket,
  Smartphone,
  Soup,
  Sparkles,
  SprayCan,
  Sprout,
  Stethoscope,
  Store,
  Sun,
  Ticket,
  Truck,
  UtensilsCrossed,
  Wallet,
  WashingMachine,
  Watch,
  Wheat,
  Wine,
  Wrench,
  type LucideIcon,
} from "lucide-react";

/**
 * The icons a category may be drawn with — the vocabulary the dashboard offers
 * and the app can render.
 *
 * **Copied between the app and the dashboard**, the same arrangement
 * `lib/units.ts` describes and for the same reason: the dashboard writes a
 * *name* and the app has to turn that name back into a picture. A name only
 * one side knows is a category that renders as nothing.
 *
 * ## Why a list rather than "any Lucide icon"
 *
 * Lucide has some fifteen hundred icons and the obvious implementation — take
 * whatever name the database holds and look it up — means importing all of
 * them. On the web that is a tree-shaking problem; in the app's React Native bundle it
 * is fifteen hundred components shipped to a phone so that twenty can be
 * drawn. Every name here is imported by hand, so the bundle carries exactly
 * this set and nothing else.
 *
 * The second reason is editorial. These are drawn at 22pt in a small well
 * behind a dish that has no photograph, and an icon chosen from the whole
 * library is as likely to be a chevron or a spreadsheet as a croissant. The
 * list is the shortlist somebody would actually pick a shop's mark from.
 *
 * ## Adding one
 *
 * Add the name here **and** in the app's copy, in the same commit. A
 * name the dashboard offers and this file has not got renders as null, which
 * `categoryArt` reads as "no override" — so the failure is a category quietly
 * falling back to its built-in glyph rather than a crash. Quiet is worse than
 * loud here, which is why the two lists are meant to be edited together.
 */
export const CATEGORY_ICONS = {
  Apple,
  Baby,
  Beef,
  Bike,
  Bone,
  BookOpen,
  Cake,
  CakeSlice,
  Candy,
  CarFront,
  Carrot,
  Cherry,
  Cigarette,
  Coffee,
  Croissant,
  CupSoda,
  Droplets,
  Drumstick,
  Dumbbell,
  Egg,
  Fish,
  Flame,
  Flower2,
  Gift,
  Glasses,
  Grape,
  Hammer,
  HeartPulse,
  House,
  IceCreamCone,
  Laptop,
  Leaf,
  Milk,
  Moon,
  Music,
  Package,
  Palette,
  PawPrint,
  Pill,
  Pizza,
  Salad,
  Sandwich,
  Scissors,
  Shirt,
  ShoppingBasket,
  Smartphone,
  Soup,
  Sparkles,
  SprayCan,
  Sprout,
  Stethoscope,
  Store,
  Sun,
  Ticket,
  Truck,
  UtensilsCrossed,
  Wallet,
  WashingMachine,
  Watch,
  Wheat,
  Wine,
  Wrench,
} satisfies Record<string, LucideIcon>;

/** A name the vocabulary knows. What `categories.empty_icon` holds. */
export type CategoryIconName = keyof typeof CATEGORY_ICONS;

/** Every name, for the dashboard's picker and for tests. */
export const CATEGORY_ICON_NAMES = Object.keys(CATEGORY_ICONS) as CategoryIconName[];

/**
 * The component for a stored name, or null.
 *
 * Null for a name this build does not know — an older app against a newer
 * dashboard, or a name removed from the list. The caller falls back to its own
 * answer rather than drawing a hole, which is the same shape `asPriceUnit`
 * uses for a unit the vocabulary has dropped.
 */
export function categoryIcon(name: string | null | undefined): LucideIcon | null {
  if (!name) return null;
  return CATEGORY_ICONS[name as CategoryIconName] ?? null;
}
