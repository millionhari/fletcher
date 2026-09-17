import type { Metadata } from "next";
import { AssetGrid } from "@/components/fletcher/asset-grid";
import { PageHeader } from "@/components/fletcher/page-header";

export const metadata: Metadata = { title: "Profile kit" };

export default function AssetsPage() {
  return (
    <div>
      <PageHeader title="Profile kit" description="The artist's live profile images, press photos and brand files. Swap these when a campaign rebrands every platform." />
      <AssetGrid scope="workspace" title="Live profile set" description="1000×1000 profile images for every platform, press photos with a horizontal option, logo and fonts." />
    </div>
  );
}
