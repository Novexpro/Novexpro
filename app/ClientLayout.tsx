"use client";

import { usePathname } from "next/navigation";
import Layout from "../components/Layout";
import { ExpandedComponentsProvider } from "../context/ExpandedComponentsContext";
import { MetalPriceProvider } from "../context/MetalPriceContext";

interface ClientLayoutProps {
  children: React.ReactNode;
}

export default function ClientLayout({ children }: ClientLayoutProps) {
  const pathname = usePathname();
  const isAuthPage = pathname?.startsWith("/auth");
  const isPrivacyPage = pathname === "/privacy-policy";
  const isTermsPage = pathname === "/terms-of-service";
  const isCookiesPage = pathname === "/cookie-policy";
  if (isAuthPage) {
    return children;
  }

  if (isPrivacyPage || isTermsPage || isCookiesPage) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-black to-gray-900">

        {children}
      </div>
    );
  }

  return (
    <ExpandedComponentsProvider>
      <MetalPriceProvider>
        <Layout>{children}</Layout>
      </MetalPriceProvider>
    </ExpandedComponentsProvider>
  );
}
