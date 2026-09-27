import type { Metadata, Viewport } from "next";
import { PANEL_METADATA, PANEL_VIEWPORT } from "@/lib/panel-brand";
import { AppShell } from "@/components/AppShell";
import { PwaHead } from "@/components/pwa/PwaHead";

export const metadata: Metadata = PANEL_METADATA;
export const viewport: Viewport = PANEL_VIEWPORT;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PwaHead />
      <AppShell>{children}</AppShell>
    </>
  );
}
