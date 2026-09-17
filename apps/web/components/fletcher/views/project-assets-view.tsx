"use client";

import { useState } from "react";
import { useProjectId } from "@/lib/hooks/use-project";
import { AssetGrid } from "@/components/fletcher/asset-grid";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function ProjectAssetsView() {
  const projectId = useProjectId();
  const [scope, setScope] = useState<"prerelease" | "release">("prerelease");
  return (
    <div>
      <Tabs value={scope} onValueChange={(v) => setScope(v as "prerelease" | "release")} className="mb-5">
        <TabsList>
          <TabsTrigger value="prerelease">Pre-release set</TabsTrigger>
          <TabsTrigger value="release">Release set</TabsTrigger>
        </TabsList>
      </Tabs>
      {scope === "prerelease" ? (
        <AssetGrid scope="prerelease" projectId={projectId} title="Pre-release set" description="Banners with the presave CTA, Clips, and the DSP exclusive photos that go out with the pitch. Every platform's exact size is listed on the slot." />
      ) : (
        <AssetGrid scope="release" projectId={projectId} title="Release set" description="Out-now banners, cover art, Canvas, playlist cover, thumbnail and ad cutdowns. Uploads are checked against each platform's spec." />
      )}
    </div>
  );
}
