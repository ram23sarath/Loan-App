import { useEffect, useRef } from "react";
import type { MutableRefObject } from "react";
import { useModalBackHandler } from "../../../../utils/useModalBackHandler";

interface UseModalBodyEffectsParams {
  expandedNoteId: string | null;
  noteRefs: MutableRefObject<{ [key: string]: HTMLDivElement | null }>;
  anyInternalModalOpen: boolean;
  closeTopInternalModal: () => void;
  onClose: () => void;
  onCollapseNote: () => void;
}

export const useModalBodyEffects = ({
  expandedNoteId,
  noteRefs,
  anyInternalModalOpen,
  closeTopInternalModal,
  onClose,
  onCollapseNote,
}: UseModalBodyEffectsParams): void => {
  useModalBackHandler(anyInternalModalOpen, closeTopInternalModal);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        expandedNoteId &&
        noteRefs.current[expandedNoteId] &&
        !noteRefs.current[expandedNoteId]?.contains(event.target as Node)
      ) {
        onCollapseNote();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [expandedNoteId, noteRefs, onCollapseNote]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      if (anyInternalModalOpen) {
        return;
      }

      onClose();
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [anyInternalModalOpen, onClose]);

  const scrollYRef = useRef<number>(0);
  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    scrollYRef.current = window.scrollY || window.pageYOffset || 0;
    const bodyStyle = document.body.style;
    bodyStyle.position = "fixed";
    bodyStyle.top = `-${scrollYRef.current}px`;
    bodyStyle.left = "0";
    bodyStyle.right = "0";
    bodyStyle.width = "100%";

    return () => {
      bodyStyle.position = "";
      bodyStyle.top = "";
      bodyStyle.left = "";
      bodyStyle.right = "";
      bodyStyle.width = "";
      window.scrollTo(0, scrollYRef.current);
    };
  }, []);
};
