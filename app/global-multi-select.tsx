"use client";

import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

export type GlobalMultiSelectOption = {
  value: string;
  label: string;
  visual?: ReactNode;
};

export default function GlobalMultiSelect({
  label,
  allLabel,
  options,
  selected,
  onChange,
}: {
  label: string;
  allLabel: string;
  options: GlobalMultiSelectOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
}) {
  const selectedSet = new Set(selected);
  const summary = selected.length === 0
    ? allLabel
    : selected.length === 1
      ? options.find((option) => option.value === selected[0])?.label ?? selected[0]
      : `${selected.length} selecionados`;

  const toggle = (value: string) => {
    onChange(
      selectedSet.has(value)
        ? selected.filter((item) => item !== value)
        : [...selected, value],
    );
  };

  return (
    <div className="global-multi-select-field">
      <span className="global-multi-select-label">{label}</span>
      <details className="global-multi-select">
        <summary aria-label={`${label}: ${summary}`}>
          <span>{summary}</span>
          <ChevronDown size={16} aria-hidden="true" />
        </summary>
        <div className="global-multi-select-menu">
          <label className="global-multi-select-option global-multi-select-option--all">
            <input
              type="checkbox"
              checked={selected.length === 0}
              onChange={() => onChange([])}
            />
            <span>{allLabel}</span>
          </label>
          {options.map((option) => (
            <label className="global-multi-select-option" key={option.value}>
              <input
                type="checkbox"
                checked={selectedSet.has(option.value)}
                onChange={() => toggle(option.value)}
              />
              {option.visual}
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </details>
    </div>
  );
}
