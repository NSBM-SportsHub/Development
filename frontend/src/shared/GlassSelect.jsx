import { createPortal } from "react-dom";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

export default function GlassSelect({
  label,
  name,
  value,
  options,
  onChange,
  required = false,
  allowCustom = false,
  placeholder = "Select an option",
}) {
  const id = useId();
  const rootRef = useRef(null);
  const menuRef = useRef(null);
  const triggerRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [query, setQuery] = useState("");
  const [menuPosition, setMenuPosition] = useState(null);
  const visibleOptions = useMemo(() => {
    if (!allowCustom || !query.trim()) return options;
    return options.filter((option) => option.label.toLowerCase().includes(query.trim().toLowerCase()));
  }, [allowCustom, options, query]);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const outsideViewport =
      rect.bottom <= 0 ||
      rect.top >= window.innerHeight ||
      rect.right <= 0 ||
      rect.left >= window.innerWidth;
    if (outsideViewport) {
      setOpen(false);
      setQuery("");
      return;
    }

    const gap = 8;
    const viewportPadding = 8;
    const availableBelow = window.innerHeight - rect.bottom - gap - viewportPadding;
    const maxHeight = Math.max(0, Math.min(window.innerHeight * 0.7, availableBelow));
    const width = Math.min(rect.width, window.innerWidth - viewportPadding * 2);

    setMenuPosition({
      left: Math.max(viewportPadding, Math.min(rect.left, window.innerWidth - width - viewportPadding)),
      top: rect.bottom + gap,
      width,
      maxHeight,
    });
  }, []);

  useEffect(() => {
    function closeOutside(event) {
      if (!rootRef.current?.contains(event.target) && !menuRef.current?.contains(event.target)) {
        setOpen(false);
        setQuery("");
      }
    }

    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    updatePosition();
    let frameId = null;
    const reposition = () => {
      if (frameId !== null) return;
      frameId = window.requestAnimationFrame(() => {
        frameId = null;
        updatePosition();
      });
    };
    const closeOnScroll = (event) => {
      if (menuRef.current?.contains(event.target)) return;
      menuRef.current?.setAttribute("hidden", "");
      setOpen(false);
      setQuery("");
    };

    window.addEventListener("resize", reposition);
    window.addEventListener("wheel", closeOnScroll, { capture: true, passive: true });
    window.addEventListener("touchmove", closeOnScroll, { capture: true, passive: true });
    window.addEventListener("scroll", closeOnScroll, true);
    return () => {
      if (frameId !== null) window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("wheel", closeOnScroll, true);
      window.removeEventListener("touchmove", closeOnScroll, true);
      window.removeEventListener("scroll", closeOnScroll, true);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) setMenuPosition(null);
  }, [open]);

  useEffect(() => {
    if (!open || !menuRef.current) return;
    menuRef.current.querySelector(`#${CSS.escape(`${id}-option-${activeIndex}`)}`)?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, id, open, visibleOptions.length]);

  function choose(option) {
    onChange(option.value);
    setOpen(false);
    setQuery("");
    setActiveIndex(0);
    triggerRef.current?.focus();
  }

  function handleKeyDown(event) {
    if (event.key === "Escape") {
      setOpen(false);
      setQuery("");
      triggerRef.current?.focus();
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        setActiveIndex(Math.max(0, options.findIndex((option) => option.value === value)));
        return;
      }
      setActiveIndex((index) => {
        const count = visibleOptions.length;
        if (!count) return 0;
        return event.key === "ArrowDown"
          ? (index + 1) % count
          : (index - 1 + count) % count;
      });
    } else if (event.key === "Home" && open) {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === "End" && open) {
      event.preventDefault();
      setActiveIndex(Math.max(0, visibleOptions.length - 1));
    } else if (event.key === "Enter" && open) {
      event.preventDefault();
      const option = visibleOptions[activeIndex];
      if (option) choose(option);
    } else if (event.key === " " && open && !allowCustom) {
      event.preventDefault();
      const option = visibleOptions[activeIndex];
      if (option) choose(option);
    }
  }

  function renderMenu() {
    if (!open || !menuPosition) return null;
    return createPortal(
      <div
        ref={menuRef}
        className="glass-select-menu"
        id={`${id}-options`}
        role="listbox"
        aria-label={label}
        style={{
          position: "fixed",
          left: menuPosition.left,
          top: menuPosition.top,
          width: menuPosition.width,
          maxHeight: menuPosition.maxHeight,
        }}
      >
        {visibleOptions.map((option, index) => (
          <div
            id={`${id}-option-${index}`}
            className={`glass-select-option${option.value === value ? " selected" : ""}${index === activeIndex ? " active" : ""}`}
            role="option"
            aria-selected={option.value === value}
            key={option.value}
            onPointerMove={() => setActiveIndex(index)}
            onPointerDown={(event) => event.preventDefault()}
            onClick={() => choose(option)}
          >
            {option.label}
          </div>
        ))}
        {!visibleOptions.length && <span className="glass-select-empty">Type a sport name to use it.</span>}
      </div>,
      document.body,
    );
  }

  return (
    <div className={`glass-select${open ? " is-open" : ""}`} ref={rootRef}>
      {allowCustom ? (
        <input
          ref={triggerRef}
          id={id}
          name={name}
          role="combobox"
          aria-label={label}
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={`${id}-options`}
          aria-activedescendant={open && visibleOptions[activeIndex] ? `${id}-option-${activeIndex}` : undefined}
          aria-required={required}
          autoComplete="off"
          placeholder={placeholder}
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            setQuery(event.target.value);
            setActiveIndex(0);
            setOpen(true);
          }}
          onFocus={() => {
            setQuery("");
            setActiveIndex(Math.max(0, options.findIndex((option) => option.value === value)));
            setOpen(true);
          }}
          onClick={() => {
            setQuery("");
            setOpen(true);
          }}
          onKeyDown={handleKeyDown}
          required={required}
        />
      ) : (
        <button
          ref={triggerRef}
          id={id}
          className="glass-select-trigger"
          type="button"
          role="combobox"
          aria-label={label}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={`${id}-options`}
          aria-activedescendant={open && visibleOptions[activeIndex] ? `${id}-option-${activeIndex}` : undefined}
          aria-required={required}
          onClick={() => {
            setQuery("");
            setActiveIndex(Math.max(0, options.findIndex((option) => option.value === value)));
            setOpen((state) => !state);
          }}
          onKeyDown={handleKeyDown}
        >
          <span className={value ? "" : "glass-select-placeholder"}>
            {options.find((option) => option.value === value)?.label ?? placeholder}
          </span>
          <span className="glass-select-chevron" aria-hidden="true" />
        </button>
      )}
      {!allowCustom && <input type="hidden" name={name} value={value} />}
      {renderMenu()}
    </div>
  );
}
