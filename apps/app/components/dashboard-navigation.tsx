import { NavTabs } from "./nav-tabs";

const tabs = [
  { name: "Projects", href: "/projects" },
  { name: "Settings", href: "/settings/general" },
];

export function DashboardNavigation() {
  return <NavTabs tabs={tabs} />;
}
