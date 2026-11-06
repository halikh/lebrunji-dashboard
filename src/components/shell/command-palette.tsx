"use client";

import { Command } from "cmdk";
import { Dialog as DialogPrimitive } from "radix-ui";
import { useRouter } from "next/navigation";
import { ArrowRight, Hash, Plus, Search } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Kbd } from "@/components/ui";
import { t } from "@/i18n/translations";

import { ALL_NAV_ITEMS } from "./nav";

/** Things to create, reachable from anywhere. */
const ACTIONS: { label: () => string; href: string; keywords: string }[] = [
  {
    label: () => t("commandPalette.newShop"),
    href: "/shops/new",
    keywords: "create add store",
  },
  {
    label: () => t("commandPalette.newDriver"),
    href: "/drivers/new",
    keywords: "create add courier",
  },
  {
    label: () => t("commandPalette.newPromotion"),
    href: "/promotions/new",
    keywords: "create add discount",
  },
  {
    label: () => t("commandPalette.newBundle"),
    href: "/bundles/new",
    keywords: "create add combo",
  },
  {
    label: () => t("commandPalette.newCategory"),
    href: "/categories/new",
    keywords: "create add",
  },
];

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  function go(href: string) {
    onOpenChange(false);
    setQuery("");
    router.push(href);
  }

  const trimmed = query.trim();

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink/30 animate-fade-in" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed top-[14vh] left-1/2 z-50 w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border border-line bg-surface shadow-lg animate-pop-in focus:outline-none"
        >
          <DialogPrimitive.Title className="sr-only">
            {t("shell.search")}
          </DialogPrimitive.Title>
          <Command loop className="flex flex-col">
            <div className="flex items-center gap-2.5 border-b border-line px-4">
              <Search className="size-4 shrink-0 text-ink-4" />
              <Command.Input
                value={query}
                onValueChange={setQuery}
                placeholder={t("shell.search")}
                className="h-12 flex-1 bg-transparent text-[15px] text-ink placeholder:text-ink-4 focus:outline-none"
              />
              <Kbd>Esc</Kbd>
            </div>
            <Command.List className="max-h-[min(420px,60vh)] overflow-y-auto p-2 scrollbar-thin">
              <Command.Empty className="px-3 py-8 text-center text-[13.5px] text-ink-3">
                {t("shell.searchEmpty")}
              </Command.Empty>

              {trimmed && (
                <Group heading={t("commandPalette.find")}>
                  <Item
                    value={`find-order ${trimmed}`}
                    onSelect={() =>
                      go(`/orders?scope=all&q=${encodeURIComponent(trimmed)}`)
                    }
                    icon={<Hash />}
                  >
                    {t("commandPalette.findOrder", { query: trimmed })}
                  </Item>
                  <Item
                    value={`find-customer ${trimmed}`}
                    onSelect={() =>
                      go(`/customers?q=${encodeURIComponent(trimmed)}`)
                    }
                    icon={<Search />}
                  >
                    {t("commandPalette.findCustomer", { query: trimmed })}
                  </Item>
                  <Item
                    value={`find-shop ${trimmed}`}
                    onSelect={() =>
                      go(`/shops?q=${encodeURIComponent(trimmed)}`)
                    }
                    icon={<Search />}
                  >
                    {t("commandPalette.findShop", { query: trimmed })}
                  </Item>
                </Group>
              )}

              <Group heading={t("shell.goTo")}>
                {ALL_NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Item
                      key={item.href}
                      value={`${t(item.labelKey)} ${item.keywords ?? ""}`}
                      onSelect={() => go(item.href)}
                      icon={<Icon />}
                    >
                      {t(item.labelKey)}
                    </Item>
                  );
                })}
              </Group>

              <Group heading={t("shell.actions")}>
                {ACTIONS.map((action) => (
                  <Item
                    key={action.href}
                    value={`${action.label()} ${action.keywords}`}
                    onSelect={() => go(action.href)}
                    icon={<Plus />}
                  >
                    {action.label()}
                  </Item>
                ))}
              </Group>
            </Command.List>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function Group({
  heading,
  children,
}: {
  heading: string;
  children: ReactNode;
}) {
  return (
    <Command.Group
      heading={heading}
      className="[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-[11.5px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-ink-4"
    >
      {children}
    </Command.Group>
  );
}

function Item({
  value,
  onSelect,
  icon,
  children,
}: {
  value: string;
  onSelect: () => void;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <Command.Item
      value={value}
      onSelect={onSelect}
      className="group flex h-10 cursor-pointer items-center gap-3 rounded-md px-2.5 text-[14px] text-ink data-[selected=true]:bg-hover [&_svg]:size-4"
    >
      <span className="text-ink-3">{icon}</span>
      <span className="flex-1 truncate">{children}</span>
      <ArrowRight className="text-ink-4 opacity-0 group-data-[selected=true]:opacity-100 rtl:rotate-180" />
    </Command.Item>
  );
}
