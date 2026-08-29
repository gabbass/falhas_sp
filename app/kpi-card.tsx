"use client";

import { ArrowRight, X } from "lucide-react";
import {
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

type KpiCardProps = {
  label: string;
  value: string;
  detail: string;
  icon: ReactNode;
  expandableDetail?: boolean;
};

function useTruncation<T extends HTMLElement>(content: string) {
  const elementRef = useRef<T>(null);
  const [truncated, setTruncated] = useState(false);

  useEffect(() => {
    const measure = () => {
      const element = elementRef.current;
      if (!element) {
        setTruncated(false);
        return;
      }
      setTruncated(
        element.scrollHeight > element.clientHeight + 3 ||
        element.scrollWidth > element.clientWidth + 3,
      );
    };

    measure();
    document.fonts?.ready.then(measure);
    const observer = new ResizeObserver(measure);
    if (elementRef.current) observer.observe(elementRef.current);
    return () => observer.disconnect();
  }, [content]);

  return { elementRef, truncated };
}

export default function KpiCard({
  label,
  value,
  detail,
  icon,
  expandableDetail = true,
}: KpiCardProps) {
  const [detailOpen, setDetailOpen] = useState(false);
  const activeTriggerRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogTitleId = useId();
  const dialogDescriptionId = useId();
  const { elementRef: labelRef, truncated: labelTruncated } = useTruncation<HTMLElement>(label);
  const { elementRef: valueRef, truncated: valueTruncated } = useTruncation<HTMLElement>(value);
  const { elementRef: detailRef, truncated: measuredDetailTruncated } = useTruncation<HTMLParagraphElement>(detail);
  const detailTruncated = expandableDetail && measuredDetailTruncated;

  useEffect(() => {
    if (!detailOpen) return;
    closeButtonRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDetailOpen(false);
        activeTriggerRef.current?.focus();
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [detailOpen]);

  const closeDetail = () => {
    setDetailOpen(false);
    requestAnimationFrame(() => activeTriggerRef.current?.focus());
  };

  const openDetail = (event: ReactMouseEvent<HTMLButtonElement>) => {
    activeTriggerRef.current = event.currentTarget;
    setDetailOpen(true);
  };

  return (
    <div className="kpi">
      <div className="kpi-icon">{icon}</div>
      <div className="kpi-content">
        <div className={`kpi-label-row ${labelTruncated ? "is-truncated" : ""}`}>
          <small ref={labelRef}>{label}</small>
          {labelTruncated ? (
            <button
              type="button"
              className="kpi-overflow-more kpi-title-more"
              aria-label={`Ler título completo de ${label}`}
              onClick={openDetail}
            >
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          ) : null}
        </div>
        <div className={`kpi-value-wrap ${valueTruncated ? "is-truncated" : ""}`}>
          <strong ref={valueRef}>{value}</strong>
          {valueTruncated ? (
            <button
              type="button"
              className="kpi-overflow-more kpi-value-more"
              aria-label={`Ler indicador completo de ${label}`}
              onClick={openDetail}
            >
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          ) : null}
        </div>
        {detail ? (
          <div className={`kpi-detail-wrap ${detailTruncated ? "is-truncated" : ""}`}>
            <p ref={detailRef} className="kpi-detail">{detail}</p>
            {detailTruncated ? (
              <button
                type="button"
                className="kpi-overflow-more kpi-detail-more"
                aria-label={`Ler descrição completa de ${label}`}
                onClick={openDetail}
              >
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {detailOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              className="kpi-detail-modal-backdrop"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) closeDetail();
              }}
            >
              <section
                className="kpi-detail-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby={dialogTitleId}
                aria-describedby={detail ? dialogDescriptionId : undefined}
              >
                <header>
                  <div>
                    <small>Detalhes do indicador</small>
                    <h2 id={dialogTitleId}>{label}</h2>
                  </div>
                  <button ref={closeButtonRef} type="button" onClick={closeDetail} aria-label="Fechar detalhes">
                    <X size={18} aria-hidden="true" />
                  </button>
                </header>
                <strong>{value}</strong>
                {detail ? <p id={dialogDescriptionId}>{detail}</p> : null}
              </section>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
