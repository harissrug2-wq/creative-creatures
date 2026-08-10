import React, { useState, useCallback, useEffect } from 'react';
import {
  QUESTIONS,
  SCALE_TEST_QUESTION,
  CATEGORY_ORDER,
  CATEGORY_COLORS,
  CATEGORY_SHORT,
  computeResults,
} from '../data/questions.js';
import QuestionCard from './QuestionCard.jsx';

const TOTAL_STEPS = 31;

export default function DiagnosticTool() {
  const [currentQ, setCurrentQ] = useState(() => {
    const saved = Number(localStorage.getItem('ccStrengthCurrentQuestion'));
    return Number.isFinite(saved) && saved >= 1 && saved <= TOTAL_STEPS ? saved : 1;
  });
  const [answers, setAnswers] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ccStrengthAnswers') || '{}'); } catch { return {}; }
  });
  const [scaleAnswer, setScaleAnswer] = useState(() => {
    const saved = localStorage.getItem('ccStrengthScaleAnswer');
    return saved === null ? undefined : Number(saved);
  });

  const isScaleTest = currentQ === 31;
  const question = isScaleTest ? SCALE_TEST_QUESTION : QUESTIONS[currentQ - 1];
  const currentAnswer = isScaleTest ? scaleAnswer : answers[question?.id];

  const activeCat = isScaleTest ? null : QUESTIONS[currentQ - 1]?.category;
  const activeCatIndex = activeCat ? CATEGORY_ORDER.indexOf(activeCat) : 5;

  const getCatProgress = (cat) => {
    const catQs = QUESTIONS.filter((q) => q.category === cat);
    return catQs.filter((q) => answers[q.id] !== undefined).length;
  };

  // Progress fraction: 0 → 100 across all 31 steps
  const progressPct = Math.round(((currentQ - 1) / TOTAL_STEPS) * 100);

  useEffect(() => {
    localStorage.setItem('ccStrengthAnswers', JSON.stringify(answers));
    localStorage.setItem('ccStrengthCurrentQuestion', String(currentQ));
    if (scaleAnswer !== undefined) localStorage.setItem('ccStrengthScaleAnswer', String(scaleAnswer));
    const answered = Object.keys(answers).length + (scaleAnswer !== undefined ? 1 : 0);
    const progress = Math.min(99, Math.round((answered / TOTAL_STEPS) * 100));
    localStorage.setItem('ccIndexStrengthProgress', String(progress));
    window.CCDiagnostic?.setProgress?.('strength', progress);
  }, [answers, scaleAnswer, currentQ]);

  const handleAnswer = useCallback((qId, value) => {
    if (qId === 'scale') setScaleAnswer(value);
    else setAnswers((prev) => ({ ...prev, [qId]: value }));
  }, []);

  const handleNext = () => {
    if (currentQ < 31) setCurrentQ((q) => q + 1);
    else {
      const results = computeResults(answers, scaleAnswer);
      window.CCDiagnostic?.mark?.('strength', results.overallScore, { results, answers, scaleAnswer });
      if (!window.CCDiagnostic) {
        localStorage.setItem('agencyStrengthScore', results.overallScore);
        localStorage.setItem('ccIndexStrengthComplete', 'true');
        localStorage.setItem('ccIndexStrengthProgress', '100');
      }
      window.location.href = '/diagnostic/';
    }
  };

  const handleBack = () => {
    if (currentQ > 1) setCurrentQ((q) => q - 1);
  };

  /* Active Category Color */
  const catColor = isScaleTest
    ? '#d97706'
    : CATEGORY_COLORS[activeCat] || '#10b981';

  return (
    <div className="app-wrapper">
      {/* ── Top Header Navigation Bar ─────────────────────── */}
      <header className="top-header">
        <div className="main-container flex items-center justify-between">
          <button onClick={() => { window.location.href = '/diagnostic/'; }} className="btn-back">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
            Back to diagnostic hub
          </button>
        </div>
      </header>

      {/* ── Centered Main Content Area ──────────────────────── */}
      <div className="main-container">
        <div className="diagnostic-shell">
          {/* ── Sidebar Navigation ─────────────────────────── */}
          <aside className="sidebar-container">
            {/* Brand Header */}
            <div>
              <div className="text-[11px] font-bold text-emerald-600 uppercase tracking-widest mb-1">
                STRENGTH
              </div>
              <h1 className="sidebar-brand-title">
                Agency<br />Strength Index
              </h1>
            </div>

            {/* Category Navigation Items */}
            <nav className="sidebar-nav-list">
              {CATEGORY_ORDER.map((cat, idx) => {
                const answered = getCatProgress(cat);
                const total = QUESTIONS.filter((q) => q.category === cat).length;
                const isDone = answered === total;
                const isActive = cat === activeCat;
                const firstQId = QUESTIONS.find((q) => q.category === cat)?.id;
                const canClick = idx <= activeCatIndex || answered > 0;

                return (
                  <button
                    key={cat}
                    onClick={() => canClick && setCurrentQ(firstQId)}
                    className={`sidebar-nav-button ${isActive ? 'active' : ''}`}
                    style={{
                      cursor: canClick ? 'pointer' : 'default',
                      opacity: canClick ? 1 : 0.7,
                    }}
                  >
                    <span>{CATEGORY_SHORT[cat]}</span>
                    {/* Circle Check Icon */}
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={isActive || isDone ? '#10b981' : '#cbd5e1'}
                      strokeWidth="2"
                    >
                      <circle cx="12" cy="12" r="9" />
                      {(isActive || isDone) && (
                        <path d="M8 12l3 3 5-5" strokeWidth="2.5" stroke="#10b981" />
                      )}
                    </svg>
                  </button>
                );
              })}

              {/* Scale Test Nav Item */}
              <button
                onClick={() => scaleAnswer !== undefined && setCurrentQ(31)}
                className={`sidebar-nav-button ${isScaleTest ? 'active' : ''}`}
                style={{
                  background: isScaleTest ? '#fef9c3' : 'transparent',
                  color: isScaleTest ? '#92400e' : undefined,
                }}
              >
                <span>Scale Test</span>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={scaleAnswer !== undefined ? '#10b981' : '#cbd5e1'}
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="9" />
                  {scaleAnswer !== undefined && (
                    <path d="M8 12l3 3 5-5" strokeWidth="2.5" stroke="#10b981" />
                  )}
                </svg>
              </button>
            </nav>
          </aside>

          {/* ── Main Question Section ──────────────────────── */}
          <main style={{ minWidth: 0 }}>
            {/* Progress Row */}
            <div className="flex items-center gap-4 mb-4">
              {/* Category Name */}
              <span
                className="text-sm font-semibold flex-shrink-0"
                style={{ color: catColor, minWidth: '90px' }}
              >
                {isScaleTest ? 'Scale Test' : CATEGORY_SHORT[activeCat]}
              </span>

              {/* Green Progress Bar */}
              <div className="flex-1 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${progressPct}%`, background: '#10b981' }}
                />
              </div>

              {/* Question Counter */}
              <span className="text-xs font-medium text-slate-400 flex-shrink-0">
                Question {currentQ} of {TOTAL_STEPS}
              </span>
            </div>

            {/* Question Card Component */}
            <QuestionCard
              key={currentQ}
              question={question}
              currentAnswer={currentAnswer}
              onAnswer={handleAnswer}
              isScaleTest={isScaleTest}
              onBack={handleBack}
              onNext={handleNext}
              canGoBack={currentQ > 1}
              isLast={currentQ === 31}
            />
          </main>
        </div>
      </div>
    </div>
  );
}
