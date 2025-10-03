import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="max-w-7xl mx-auto p-4 space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <span className="text-2xl font-medium tracking-tight">oracode</span>
        </div>
        <Avatar>
          <AvatarImage src="https://github.com/chickencoder.png" />
          <AvatarFallback>JS</AvatarFallback>
        </Avatar>
      </header>
      {children}
    </div>
  );
}
