import { NavTabs } from "@/components/nav-tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const tabs = [
  { name: "Projects", href: "/projects" },
  { name: "Settings", href: "/settings" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="max-w-5xl mx-auto p-4 space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <span className="text-2xl font-medium tracking-tight">oracode</span>
        </div>
        <Avatar>
          <AvatarImage src="https://github.com/chickencoder.png" />
          <AvatarFallback>JS</AvatarFallback>
        </Avatar>
      </header>
      <NavTabs tabs={tabs} />
      {children}
    </div>
  );
}
