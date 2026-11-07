import type { Stamp } from "../types";
import { DEFAULT_INK, INK_PRESETS, inkValues, type InkSettings } from "../lib/ink";
import { Icon } from "./ui";

type Props = {
  stamp: Stamp;
  onChange: (patch: Partial<Stamp>) => void;
  onPreset: (patch: Partial<Stamp>) => void;
};

export function InkControls({ stamp, onChange, onPreset }: Props) {
  const value = inkValues(stamp);
  return (
    <fieldset disabled={stamp.locked} className="ink-controls" aria-label="সিলের আলো ও কালি">
      <div className="ink-heading">
        <span><Icon.Sun className="h-4 w-4" /> আলো ও কালি</span>
        <button type="button" onClick={() => onPreset(DEFAULT_INK)} title="শুধু আলো ও কালি রিসেট করুন">রিসেট</button>
      </div>
      <p className="ink-description">শুধু নির্বাচিত সিল বদলাবে, মূল ছবি নয়।</p>
      <div className="ink-presets" aria-label="কালির প্রিসেট">
        {INK_PRESETS.map((preset) => {
          const active = (Object.keys(preset.values) as Array<keyof InkSettings>).every((key) => value[key] === preset.values[key]);
          return <button type="button" key={preset.id} aria-pressed={active} onClick={() => onPreset(preset.values)}>{preset.label}</button>;
        })}
      </div>
      {([
        { key: "opacity", label: "কালির গাঢ়তা", low: "হালকা", high: "গাঢ়", min: 5, max: 100, value: Math.round(value.opacity * 100) },
        { key: "brightness", label: "উজ্জ্বলতা", low: "আলো কম", high: "আলো বেশি", min: 40, max: 180, value: value.brightness },
        { key: "contrast", label: "কনট্রাস্ট", low: "নরম", high: "স্পষ্ট", min: 50, max: 180, value: value.contrast },
      ] as const).map((control) => (
        <label key={control.key} className="ink-slider">
          <span><span>{control.label}</span><output>{control.value}%</output></span>
          <input type="range" aria-label={control.label} min={control.min} max={control.max} step={1} value={control.value} onChange={(e) => onChange({ [control.key]: +e.target.value / (control.key === "opacity" ? 100 : 1) })} />
          <small><span>{control.low}</span><span>{control.high}</span></small>
        </label>
      ))}
      <div className="ink-blend" role="group" aria-label="কাগজের সঙ্গে মেশানো">
        <button type="button" aria-pressed={value.blend === "normal"} onClick={() => onPreset({ blend: "normal" })}>সাধারণ</button>
        <button type="button" aria-pressed={value.blend === "ink"} onClick={() => onPreset({ blend: "ink" })}><Icon.Check className="h-3.5 w-3.5" /> কাগজে মেশান</button>
      </div>
    </fieldset>
  );
}