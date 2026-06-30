import { Suspense } from "react";

import { InviteClient } from "./invite-client";

export default function InvitePage() {
  return (
    <Suspense>
      <InviteClient />
    </Suspense>
  );
}
