"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Sidebar,
  SidebarContent,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { motion } from "framer-motion";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { NavTabs } from "@/components/nav-tabs";
import { Settings, Users, BarChart3, CreditCard } from "lucide-react";

const settingsLinks = [
  { href: "/general", label: "General", icon: Settings },
  { href: "/users", label: "Users", icon: Users },
  { href: "/usage", label: "Usage", icon: BarChart3 },
  { href: "/billing", label: "Billing", icon: CreditCard },
];

const tabs = [
  { name: "Projects", href: "/projects" },
  { name: "Settings", href: "/settings/general" },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [hoveredLink, setHoveredLink] = useState<string | null>(null);
  const [linkPosition, setLinkPosition] = useState({ top: 0, height: 0 });
  const [activePosition, setActivePosition] = useState({ top: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const linkRefs = useRef<Map<string, HTMLAnchorElement>>(new Map());

  const activePath = `/settings${
    settingsLinks.find((link) => pathname === `/settings${link.href}`)?.href
  }`;

  // Update active link position when pathname changes
  useEffect(() => {
    const updateActivePosition = () => {
      const container = containerRef.current;
      const activeLink = linkRefs.current.get(activePath);
      if (!container || !activeLink) return;

      const containerRect = container.getBoundingClientRect();
      const linkRect = activeLink.getBoundingClientRect();

      setActivePosition({
        top: linkRect.top - containerRect.top,
        height: linkRect.height,
      });
    };

    const timer = setTimeout(updateActivePosition, 0);
    return () => clearTimeout(timer);
  }, [pathname, activePath]);

  const handleMouseEnter = (
    e: React.MouseEvent<HTMLAnchorElement>,
    href: string,
  ) => {
    const container = containerRef.current;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const linkRect = e.currentTarget.getBoundingClientRect();

    setHoveredLink(href);
    setLinkPosition({
      top: linkRect.top - containerRect.top,
      height: linkRect.height,
    });
  };

  const handleMouseLeave = () => {
    setHoveredLink(null);
  };

  const displayPosition = hoveredLink ? linkPosition : activePosition;

  return (
    <>
      <NavTabs tabs={tabs} />
      <SidebarProvider className="items-start">
        <Sidebar
          collapsible="none"
          className="hidden md:flex p-0 bg-transparent"
        >
          <SidebarContent>
            <div
              className="relative px-2 py-2"
              ref={containerRef}
              onMouseLeave={handleMouseLeave}
            >
              <motion.div
                className="absolute bg-muted/70 rounded-md pointer-events-none left-2 right-2"
                initial={false}
                animate={{
                  top: displayPosition.top,
                  height: displayPosition.height,
                }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
              <nav className="flex flex-col gap-1">
                {settingsLinks.map((link) => {
                  const fullPath = `/settings${link.href}`;
                  const isActive = pathname === fullPath;
                  const Icon = link.icon;

                  return (
                    <Link
                      key={link.href}
                      href={fullPath}
                      ref={(el) => {
                        if (el) linkRefs.current.set(fullPath, el);
                        else linkRefs.current.delete(fullPath);
                      }}
                      onMouseEnter={(e) => handleMouseEnter(e, fullPath)}
                      className={cn(
                        "px-3 py-2 text-sm font-medium rounded-md transition-colors relative z-10 flex items-center gap-2",
                        isActive
                          ? "text-foreground"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {link.label}
                    </Link>
                  );
                })}
              </nav>
            </div>
          </SidebarContent>
        </Sidebar>
        <main className="flex flex-1 flex-col overflow-hidden px-8">
          {children}
        </main>
      </SidebarProvider>
    </>
  );
}
