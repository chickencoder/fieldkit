import { ProjectSettingsSidebar } from "@/components/project-settings-sidebar";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ProjectSettingsSidebar>{children}</ProjectSettingsSidebar>;
}
