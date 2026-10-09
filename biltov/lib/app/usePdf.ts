"use client";

import { useCallback } from "react";
import { useAppData } from "./store";
import { buildDocumentPdf, docFileName } from "./pdf";
import { downloadBlob } from "./send";
import type { Doc } from "./types";

/** PDF d'un document avec les données à jour du compte (filigrane en démo). */
export function usePdf() {
  const { data, isDemo, getBlob } = useAppData();
  const make = useCallback(
    async (doc: Doc) => {
      const source = doc.sourceId ? data.docs.find((d) => d.id === doc.sourceId) : null;
      const pdf = await buildDocumentPdf(doc, data, { source, watermark: isDemo ? "DÉMONSTRATION" : undefined, getBlob });
      const name = docFileName(doc, data.clients.find((c) => c.id === doc.clientId));
      const blob = pdf.output("blob");
      return { pdf, name, blob, file: new File([blob], name, { type: "application/pdf" }) };
    },
    [data, isDemo, getBlob],
  );
  const preview = useCallback(async (doc: Doc) => {
    const w = window.open("", "_blank");
    const { blob } = await make(doc);
    const url = URL.createObjectURL(blob);
    if (w) w.location.href = url;
    else window.location.href = url;
  }, [make]);
  const download = useCallback(async (doc: Doc) => {
    const { blob, name } = await make(doc);
    downloadBlob(blob, name);
  }, [make]);
  return { make, preview, download };
}
