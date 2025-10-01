"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

interface Tab {
  name: string;
  href: string;
}

interface NavTabsProps {
  tabs: Tab[];
}

export function NavTabs({ tabs }: NavTabsProps) {
  const pathname = usePathname();
  const [hoveredTab, setHoveredTab] = useState<string | null>(null);
  const [tabPosition, setTabPosition] = useState({ left: 0, width: 0 });
  const [activePosition, setActivePosition] = useState({ left: 0, width: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Map<string, HTMLAnchorElement>>(new Map());

  // Update active tab position when pathname changes
  useEffect(() => {
    const updateActivePosition = () => {
      const container = containerRef.current;
      const activeTab = tabRefs.current.get(pathname);
      if (!container || !activeTab) return;

      const containerRect = container.getBoundingClientRect();
      const linkRect = activeTab.getBoundingClientRect();

      setActivePosition({
        left: linkRect.left - containerRect.left,
        width: linkRect.width,
      });
    };

    // Use setTimeout to ensure refs are set and layout is complete
    const timer = setTimeout(updateActivePosition, 0);
    return () => clearTimeout(timer);
  }, [pathname]);

  const handleMouseEnter = (
    e: React.MouseEvent<HTMLAnchorElement>,
    href: string,
  ) => {
    const container = containerRef.current;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const linkRect = e.currentTarget.getBoundingClientRect();

    setHoveredTab(href);
    setTabPosition({
      left: linkRect.left - containerRect.left,
      width: linkRect.width,
    });
  };

  const handleMouseLeave = () => {
    setHoveredTab(null);
  };

  const displayPosition = hoveredTab ? tabPosition : activePosition;
  const shouldShow = hoveredTab || tabs.some((tab) => tab.href === pathname);

  return (
    <nav className="border-b">
      <div
        className="flex gap-1 relative"
        ref={containerRef}
        onMouseLeave={handleMouseLeave}
      >
        {shouldShow && (
          <motion.div
            className="absolute bg-muted/70 rounded-md pointer-events-none top-0 bottom-2"
            initial={false}
            animate={{
              left: displayPosition.left,
              width: displayPosition.width,
            }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          />
        )}
        {tabs.map((tab) => {
          const isActive = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              ref={(el) => {
                if (el) tabRefs.current.set(tab.href, el);
                else tabRefs.current.delete(tab.href);
              }}
              onMouseEnter={(e) => handleMouseEnter(e, tab.href)}
              className={cn(
                "pb-2 border-b-2 text-sm font-medium transition-colors relative",
                isActive
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="inline-block px-3 py-2 rounded-md relative z-10">
                {tab.name}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
