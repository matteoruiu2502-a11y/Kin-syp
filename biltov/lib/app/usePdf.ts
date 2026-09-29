"use client";

import { useCallback } from "react";
import { useAppData } from "./store";
import { buildDocumentPdf, docFileName } from "./pdf";
import { downloadBlob } from "./send";
import type { Doc } from "./types";

/** Génère le PDF d'un document avec les données à jour du compte. */
export function usePdf() {
  const { data, isDemo } = useAppData();
  const make = useCallback(
    (doc: Doc) => {
      const job = data.jobs.find((j) => j.id === doc.jobId)!;
      const source = doc.sourceId ? data.docs.find((d) => d.id === doc.sourceId) : null;
      const pdf = buildDocumentPdf(doc, job, data, source, isDemo ? "DÉMONSTRATION" : undefined);
      const name = docFileName(doc, job);
      return { pdf, name, blob: pdf.output("blob"), file: new File([pdf.output("blob")], name, { type: "application/pdf" }) };
    },
    [data, isDemo],
  );
  const preview = useCallback((doc: Doc) => window.open(URL.createObjectURL(make(doc).blob), "_blank"), [make]);
  const download = useCallback((doc: Doc) => {
    const { blob, name } = make(doc);
    downloadBlob(blob, name);
  }, [make]);
  return { make, preview, download };
}
