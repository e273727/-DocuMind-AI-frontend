import React, { useRef, useEffect } from 'react';
import { ArrowUp, Paperclip, Sparkles } from 'lucide-react';

export default function Composer({
  value,
  onChange,
  onSend,
  disabled,
  loading,
  placeholder,
  onAttachClick
}) {
  const textareaRef = useRef(null);

  // Auto-resize textarea up to 140px
  const handleInput = (e) => {
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
    onChange(el.value);
  };

  // Reset textarea height after sending
  useEffect(() => {
    if (!value && textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [value]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && !loading && value.trim()) {
        onSend();
      }
    }
  };

  const canSubmit = !disabled && !loading && value.trim().length > 0;

  return (
    <div className="composer-fixed-wrapper">
      <div className="composer-inner-capsule">
        <textarea
          ref={textareaRef}
          className="composer-textarea"
          rows={1}
          placeholder={placeholder || "Ask anything about your documents..."}
          value={value}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          disabled={disabled}
        />

        <div className="composer-toolbar">
          <div className="composer-toolbar-left">
            {onAttachClick && (
              <button
                type="button"
                className="composer-tool-btn"
                title="Upload document"
                onClick={onAttachClick}
              >
                <Paperclip size={16} />
              </button>
            )}
            <span className="composer-hint-text">
              Press <kbd>↵</kbd> to send, <kbd>Shift</kbd>+<kbd>↵</kbd> for newline
            </span>
          </div>

          <div className="composer-toolbar-right">
            <button
              type="button"
              className={`composer-send-btn ${canSubmit ? 'active' : ''}`}
              onClick={onSend}
              disabled={!canSubmit}
              title={canSubmit ? "Send message (Enter)" : "Enter a question"}
              aria-label="Send message"
            >
              <ArrowUp size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
