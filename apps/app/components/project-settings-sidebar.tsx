"use client";

import { useParams, usePathname } from "next/navigation";
import Link from "next/link";
import { Id } from "@repo/convex/_generated/dataModel";
import { Sidebar, SidebarContent, SidebarProvider } from "@/components/ui/sidebar";
import { motion } from "framer-motion";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

const settingsLinks = [
  { href: "", label: "General" },
  { href: "/environment", label: "Environment Variables" },
];

type ProjectSettingsSidebarProps = {
  children: React.ReactNode;
};

export function ProjectSettingsSidebar({
  children,
}: ProjectSettingsSidebarProps) {
  const params = useParams();
  const pathname = usePathname();
  const projectId = params.projectId as Id<"projects">;
  const [hoveredLink, setHoveredLink] = useState<string | null>(null);
  const [linkPosition, setLinkPosition] = useState({ top: 0, height: 0 });
  const [activePosition, setActivePosition] = useState({ top: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const linkRefs = useRef<Map<string, HTMLAnchorElement>>(new Map());

  const activePath = settingsLinks.find((link) => {
    const fullPath = `/projects/${projectId}/settings${link.href}`;
    return pathname === fullPath;
  })
    ? pathname
    : "";

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
    href: string
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
    <SidebarProvider className="items-start">
      <Sidebar collapsible="none" className="hidden md:flex bg-background">
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
                const fullPath = `/projects/${projectId}/settings${link.href}`;
                const isActive = pathname === fullPath;

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
                      "px-3 py-2 text-sm font-medium rounded-md transition-colors relative z-10",
                      isActive
                        ? "text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </SidebarContent>
      </Sidebar>
      <main className="flex flex-1 flex-col overflow-hidden px-6">
        {children}
      </main>
    </SidebarProvider>
  );
}
