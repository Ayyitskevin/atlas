"use client";

import { useSearchParams } from "next/navigation";

import { AtlasClient } from "../atlas-client";

export function InviteClient() {
  const searchParams = useSearchParams();
  return <AtlasClient initialInviteToken={searchParams.get("token") ?? ""} />;
}
