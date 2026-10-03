"use client";

import { useState } from "react";
import { Calculator } from "lucide-react";
import { useTr } from "@/lib/app/tr";
import { useFmt } from "@/lib/app/format";
import { DENSITY, area, linear, seedKg, tiles, tilesToM2, tonnage, volume } from "@/lib/app/calc";
import type { LineCategory } from "@/lib/app/types";
import { Field, Modal, SubTabs, inputClass } from "./ui";

export type CalcResult = { label: string; qty: number; unit: string; category: LineCategory };
type Mode = "surface" | "volume" | "tiles" | "lawn" | "linear";

const Num = ({ label, value, onChange, step = "0.01" }: { label: string; value: number; onChange: (n: number) => void; step?: string }) => (
  <Field label={label}>
    <input type="number" step={step} className={inputClass} value={value || ""} onChange={(e) => onChange(e.target.valueAsNumber || 0)} />
  </Field>
);

/** Calculateur de quantités : surfaces, volumes / tonnages (terre, gravier, paillis), carrelage avec perte, gazon, linéaires. */
export function QuantityCalculator({ onClose, onInsert }: { onClose: () => void; onInsert?: (r: CalcResult) => void }) {
  const { t } = useTr();
  const f = useFmt();
  const [mode, setMode] = useState<Mode>("surface");
  const [L, setL] = useState(5);
  const [W, setW] = useState(4);
  const [extra, setExtra] = useState(0); // surface ajoutée (m²)
  const [thick, setThick] = useState(10);
  const [material, setMaterial] = useState("Terre arable");
  const [density, setDensity] = useState(DENSITY["Terre arable"]);
  const [compaction, setCompaction] = useState(10);
  const [tw, setTw] = useState(60);
  const [th, setTh] = useState(60);
  const [waste, setWaste] = useState(10);
  const [perBox, setPerBox] = useState(4);
  const [count, setCount] = useState(0);
  const [gpm, setGpm] = useState(35);
  const [piece, setPiece] = useState(1);
  const s = round(area(L, W) + extra);
  const v = volume(s, thick);
  const tile = tiles(s, tw, th, waste, perBox);
  const result: CalcResult =
    mode === "surface"
      ? { label: t("Surface"), qty: s, unit: "m²", category: "installed_material" }
      : mode === "volume"
        ? { label: `${t(material)} — ${thick} cm`, qty: v, unit: "m³", category: material.includes("Terre") || material.includes("Paillis") ? "garden_creation" : "installed_material" }
        : mode === "tiles"
          ? { label: t("Carrelage {w}×{h} (perte {p} %)", { w: tw, h: th, p: waste }), qty: tile.m2Ordered, unit: "m²", category: "installed_material" }
          : mode === "lawn"
            ? { label: t("Semis de gazon ({g} g/m²)", { g: gpm }), qty: s, unit: "m²", category: "garden_creation" }
            : { label: t("Éléments linéaires"), qty: linear(L, piece, waste), unit: "u", category: "installed_material" };

  return (
    <Modal
      wide
      title={t("Calculateur de quantités")}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="btn-ghost text-sm">
            {t("Fermer")}
          </button>
          {onInsert && (
            <button disabled={!result.qty} onClick={() => onInsert(result)} className="btn-primary text-sm disabled:opacity-40">
              <Calculator className="h-4 w-4" /> {t("Ajouter au devis : {q} {u}", { q: f.num(result.qty), u: result.unit })}
            </button>
          )}
        </>
      }
    >
      <div className="space-y-5">
        <SubTabs
          value={mode}
          onChange={setMode}
          tabs={[
            { id: "surface", label: t("Surface") },
            { id: "volume", label: t("Volume / tonnage") },
            { id: "tiles", label: t("Carrelage / pavés") },
            { id: "lawn", label: t("Gazon") },
            { id: "linear", label: t("Linéaire") },
          ]}
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <Num label={mode === "linear" ? t("Longueur totale (m)") : t("Longueur (m)")} value={L} onChange={setL} />
          {mode !== "linear" && <Num label={t("Largeur (m)")} value={W} onChange={setW} />}
          {mode !== "linear" && <Num label={t("Surface à ajouter (m²)")} value={extra} onChange={setExtra} />}
          {mode === "volume" && (
            <>
              <Field label={t("Matériau")}>
                <select
                  className={inputClass}
                  value={material}
                  onChange={(e) => {
                    setMaterial(e.target.value);
                    setDensity(DENSITY[e.target.value]);
                  }}
                >
                  {Object.keys(DENSITY).map((k) => (
                    <option key={k} value={k}>
                      {t(k)}
                    </option>
                  ))}
                </select>
              </Field>
              <Num label={t("Épaisseur (cm)")} value={thick} onChange={setThick} step="1" />
              <Num label={t("Masse volumique (t/m³)")} value={density} onChange={setDensity} />
              <Num label={t("Foisonnement / tassement (%)")} value={compaction} onChange={setCompaction} step="1" />
            </>
          )}
          {mode === "tiles" && (
            <>
              <Num label={t("Carreau : largeur (cm)")} value={tw} onChange={setTw} step="1" />
              <Num label={t("Carreau : longueur (cm)")} value={th} onChange={setTh} step="1" />
              <Num label={t("Perte de découpe (%)")} value={waste} onChange={setWaste} step="1" />
              <Num label={t("Carreaux par boîte")} value={perBox} onChange={setPerBox} step="1" />
              <Num label={t("Conversion : nombre de carreaux")} value={count} onChange={setCount} step="1" />
            </>
          )}
          {mode === "lawn" && <Num label={t("Semences (g/m²)")} value={gpm} onChange={setGpm} step="1" />}
          {mode === "linear" && (
            <>
              <Num label={t("Longueur d'un élément (m)")} value={piece} onChange={setPiece} />
              <Num label={t("Perte (%)")} value={waste} onChange={setWaste} step="1" />
            </>
          )}
        </div>
        <div className="card grid gap-3 p-5 text-sm sm:grid-cols-3">
          {mode !== "linear" && <Res label={t("Surface")} value={`${f.num(s)} m²`} />}
          {mode === "volume" && (
            <>
              <Res label={t("Volume")} value={`${f.num(v)} m³`} />
              <Res label={t("Tonnage à commander")} value={`${f.num(tonnage(v, density, compaction))} t`} />
            </>
          )}
          {mode === "tiles" && (
            <>
              <Res label={t("Carreaux")} value={`${tile.tiles} (${f.num(tile.tileM2, 3)} m²/u)`} />
              <Res label={t("Boîtes")} value={tile.boxes ? `${tile.boxes} → ${f.num(tile.m2Ordered)} m²` : "—"} />
              {count > 0 && <Res label={t("{n} carreaux =", { n: count })} value={`${f.num(tilesToM2(count, tw, th))} m²`} />}
            </>
          )}
          {mode === "lawn" && <Res label={t("Semences")} value={`${f.num(seedKg(s, gpm))} kg`} />}
          {mode === "linear" && <Res label={t("Éléments")} value={String(linear(L, piece, waste))} />}
        </div>
      </div>
    </Modal>
  );
}

const round = (n: number) => Math.round(n * 100) / 100;
const Res = ({ label, value }: { label: string; value: string }) => (
  <p>
    <span className="block text-xs uppercase tracking-wider text-slate-500">{label}</span>
    <span className="font-display text-xl font-bold tabular-nums text-white">{value}</span>
  </p>
);
