import "./globals.css";

import type { Metadata } from "next";
import type { ReactNode } from "react";

import { I18nProvider } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Betalab",
  description: "LC-MS/MS laboratory simulation prototype",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  // `lang` starts at the default and is corrected by the provider once the
  // browser's stored preference is readable; the markup itself is locale-free.
  return (
    <html lang="en">
      <body>
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
