import React from 'react';

/*
 * QuestionCard — Multiple Choice Question (MCQ) Radio Cards component
 * Matches exact design, options from PDF, and responsive layouts.
 */

export default function QuestionCard({
  question,
  currentAnswer,
  onAnswer,
  isScaleTest,
  onBack,
  onNext,
  canGoBack,
  isLast,
  isSaving = false,
  saveError = '',
  finishLabel = 'Save & finish',
}) {
  if (!question) return null;

  const selectedValue = currentAnswer;
  const canProceed = selectedValue !== undefined && selectedValue !== null;

  const handleSelect = (val) => {
    if (isSaving) return;
    onAnswer(isScaleTest ? 'scale' : question.id, val);
  };

  return (
    <div className="q-card fade-in">
      {/* ── Stress-test / Scale badge ─────────────────── */}
      {(question.stressTest || isScaleTest) && (
        <div style={{ padding: '20px 28px 0' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 12px',
              borderRadius: 20,
              fontSize: 11,
              fontWeight: 700,
              background: isScaleTest ? '#fffbeb' : '#fff7ed',
              color: isScaleTest ? '#d97706' : '#ea580c',
              border: `1px solid ${isScaleTest ? '#fde68a' : '#fed7aa'}`,
            }}
          >
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              {isScaleTest ? (
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              ) : (
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              )}
            </svg>
            {isScaleTest ? 'Scale Test — Validation Question' : 'Strength Stress Test'}
          </span>
        </div>
      )}

      {/* ── Question text ─────────────────────────────── */}
      <div style={{ padding: '24px 28px 20px' }}>
        <h2
          style={{
            fontSize: 'clamp(18px, 2.5vw, 22px)',
            fontWeight: 700,
            color: '#0f172a',
            lineHeight: 1.35,
          }}
        >
          {question.text}
        </h2>
      </div>

      {/* ── MCQ Options List ───────────────────────────── */}
      <div
        style={{
          padding: '0 28px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {question.options.map((option, idx) => {
          const isSelected = selectedValue === option.value;
          const optionLetter = String.fromCharCode(65 + idx); // A, B, C, D, E

          return (
            <div
              key={idx}
              onClick={() => handleSelect(option.value)}
              className="radio-option-card"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 18px',
                borderRadius: 12,
                border: isSelected ? '2px solid #4f46e5' : '1px solid #e2e8f0',
                background: isSelected ? '#f5f3ff' : '#f8fafc',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1 }}>
                {/* Letter Badge */}
                <div
                  style={{
                    flexShrink: 0,
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: isSelected ? '#4f46e5' : '#e2e8f0',
                    color: isSelected ? '#ffffff' : '#64748b',
                    fontSize: 13,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {optionLetter}
                </div>

                {/* Option Text */}
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: isSelected ? 600 : 400,
                    color: isSelected ? '#1e1b4b' : '#334155',
                    lineHeight: 1.45,
                  }}
                >
                  {option.label}
                </span>
              </div>

              {/* Radio Indicator */}
              <div
                style={{
                  flexShrink: 0,
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  border: isSelected ? '2px solid #4f46e5' : '2px solid #cbd5e1',
                  background: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginLeft: 12,
                }}
              >
                {isSelected && (
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: '#4f46e5',
                    }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {saveError && (
        <div style={{ margin: '0 28px 18px', padding: '12px 14px', borderRadius: 10, background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: 13, lineHeight: 1.45 }}>
          {saveError}
        </div>
      )}

      {/* ── Divider ──────────────────────────────────── */}
      <div style={{ height: 1, background: '#f1f5f9', margin: 0 }} />

      {/* ── Navigation — inside the card ─────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 28px',
        }}
      >
        {/* Back Button */}
        {canGoBack ? (
          <button className="btn-back" onClick={onBack}>
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
            Back
          </button>
        ) : (
          <span />
        )}

        {/* Next / Save & finish Button */}
        <button
          className={`btn-next ${canProceed && !isSaving ? 'active' : 'disabled'}`}
          disabled={!canProceed || isSaving}
          onClick={canProceed && !isSaving ? onNext : undefined}
        >
          {isSaving ? 'Saving & regenerating…' : (isLast ? finishLabel : 'Next')}
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
