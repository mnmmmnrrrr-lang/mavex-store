"use client";

import { useEffect, useState, type FormEvent } from "react";

export type SizeFinderOption = {
  size: string;
  width: number;
  length: number;
  stock: number;
};

type FitPreference = "slim" | "regular" | "oversized";
type Recommendation = { size: string; width: number; length: number; substituted: boolean };

type SizeFinderProps = {
  title: string;
  options: SizeFinderOption[];
  pants: boolean;
  onApply: (size: string) => void;
};

export default function SizeFinder({ title, options, pants, onApply }: SizeFinderProps) {
  const [open, setOpen] = useState(false);
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [fit, setFit] = useState<FitPreference>("regular");
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  function calculate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");
    setRecommendation(null);

    const heightNumber = Number(height);
    const weightNumber = Number(weight);
    if (!Number.isFinite(heightNumber) || !Number.isFinite(weightNumber) || heightNumber < 120 || heightNumber > 220 || weightNumber < 30 || weightNumber > 250) {
      setNotice("Enter a height from 120 to 220 cm and a weight from 30 to 250 kg.");
      return;
    }

    const fitAdjustment = pants
      ? { slim: -2, regular: 0, oversized: 3 }[fit]
      : { slim: -5, regular: 0, oversized: 8 }[fit];
    const targetLength = heightNumber * (pants ? 0.61 : 0.41);
    const targetWidth = pants
      ? weightNumber * 0.28 + 13 + fitAdjustment
      : weightNumber * 0.7 + 60 + fitAdjustment;

    const ranked = options
      .filter((option) => Number.isFinite(option.width) && Number.isFinite(option.length))
      .map((option, index) => {
        // Hoodie chart widths below 70 cm are flat measurements; compare their circumference.
        const comparableWidth = !pants && option.width < 70 ? option.width * 2 : option.width;
        const widthScale = pants ? 3 : 8;
        const lengthScale = pants ? 8 : 6;
        const score = Math.abs(comparableWidth - targetWidth) / widthScale
          + Math.abs(option.length - targetLength) / lengthScale;
        return { option, score, index };
      })
      .sort((a, b) => a.score - b.score || a.index - b.index);

    const bestFit = ranked[0]?.option;
    if (!bestFit) {
      setNotice("A size chart is not available for this product.");
      return;
    }

    const bestAvailable = ranked.find(({ option }) => option.stock > 0)?.option;
    if (!bestAvailable) {
      setNotice("All sizes for this color are currently sold out.");
      return;
    }

    const measurements = options.find((option) => option.size === bestAvailable.size);
    setRecommendation({
      size: bestAvailable.size,
      width: measurements?.width ?? bestAvailable.width,
      length: measurements?.length ?? bestAvailable.length,
      substituted: bestFit.stock <= 0,
    });
  }

  function applyRecommendation() {
    if (!recommendation) return;
    onApply(recommendation.size);
    setOpen(false);
    setRecommendation(null);
    setNotice("");
  }

  return (
    <>
      <button type="button" className="mavex-size-finder-trigger" onClick={() => setOpen(true)}>
        FIND MY SIZE
      </button>

      {open && (
        <div
          className="mavex-size-finder-backdrop"
          role="presentation"
          onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}
        >
          <section className="mavex-size-finder-modal" role="dialog" aria-modal="true" aria-labelledby="mavex-size-finder-title">
            <button type="button" className="mavex-size-finder-close" aria-label="Close size finder" onClick={() => setOpen(false)}>×</button>
            <div className="mavex-size-finder-stripes">
              <div className="mavex-size-finder-content">
                <h2 id="mavex-size-finder-title" className="mavex-size-finder-heading">FIND MY SIZE</h2>
                <span className="mavex-size-finder-badge">“{title}”</span>
                <p className="mavex-size-finder-intro">Enter your measurements to find the closest in-stock size.</p>

                <form onSubmit={calculate}>
                  <div className="mavex-size-finder-inputs">
                    <label className="mavex-size-finder-field">
                      <span>HEIGHT <small>(cm)</small></span>
                      <input required type="number" min="120" max="220" step="1" inputMode="numeric" value={height} onChange={(event) => setHeight(event.target.value)} placeholder="170" />
                    </label>
                    <label className="mavex-size-finder-field">
                      <span>WEIGHT <small>(kg)</small></span>
                      <input required type="number" min="30" max="250" step="0.1" inputMode="decimal" value={weight} onChange={(event) => setWeight(event.target.value)} placeholder="65" />
                    </label>
                  </div>

                  <fieldset className="mavex-size-finder-fit">
                    <legend>FIT PREFERENCE</legend>
                    <div>
                      {([
                        ["slim", "SLIM"],
                        ["regular", "REGULAR"],
                        ["oversized", "OVERSIZED"],
                      ] as const).map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          aria-pressed={fit === value}
                          className={fit === value ? "is-selected" : ""}
                          onClick={() => { setFit(value); setRecommendation(null); setNotice(""); }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </fieldset>

                  <button className="mavex-size-finder-calculate" type="submit">CALCULATE SIZE</button>
                </form>

                {notice && <p className="mavex-size-finder-notice" role="status">{notice}</p>}
                {recommendation && (
                  <div className="mavex-size-finder-result" role="status">
                    <p>{recommendation.substituted ? "CLOSEST AVAILABLE SIZE:" : "RECOMMENDED SIZE:"}</p>
                    <strong>{recommendation.size}</strong>
                    <span>Length {recommendation.length} × Width {recommendation.width} cm · {options.find((option) => option.size === recommendation.size)?.stock} in stock</span>
                    <button type="button" onClick={applyRecommendation}>APPLY SIZE</button>
                  </div>
                )}
                <p className="mavex-size-finder-disclaimer">Size suggestions are estimates based on the product chart and selected fit.</p>
              </div>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
