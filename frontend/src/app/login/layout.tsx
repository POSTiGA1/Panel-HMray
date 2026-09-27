import type { Metadata, Viewport } from "next";
import { PANEL_METADATA, PANEL_VIEWPORT } from "@/lib/panel-brand";
import { PwaHead } from "@/components/pwa/PwaHead";

export const metadata: Metadata = PANEL_METADATA;
export const viewport: Viewport = PANEL_VIEWPORT;

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PwaHead />
      {children}
    </>
  );
}
