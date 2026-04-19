"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

export default function OldFolderRedirect() {
  const params = useParams();
  const router = useRouter();
  useEffect(() => {
    router.replace(`/folders/${String(params.folderId ?? "")}`);
  }, [params.folderId, router]);
  return null;
}
