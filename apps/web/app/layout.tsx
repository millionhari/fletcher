import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { TRPCReactProvider } from "@/lib/trpc/client";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], axes: ["opsz"] });
const mono = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Fletcher", template: "%s · Fletcher" },
  description: "Release planning, creative review and rollout for artist teams.",
};

const themeScript = `(function(){try{var t=localStorage.getItem("fletcher-theme");if(t==="dark"||(!t&&window.matchMedia("(prefers-color-scheme: dark)").matches)){document.documentElement.classList.add("dark")}}catch(e){}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable} h-full`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <TRPCReactProvider>
          <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
        </TRPCReactProvider>
        <Toaster position="bottom-right" richColors closeButton />
      </body>
    </html>
  );
}
