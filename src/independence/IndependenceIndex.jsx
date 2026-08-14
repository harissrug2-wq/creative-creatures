import React, { useEffect, useState } from 'react';
import { CATEGORIES, QUESTIONS } from './questionsData.js';

const TIME_ALLOCATION_QUESTION = QUESTIONS.find(q => q.id === 24) || {};
const STRATEGIC_TIME_ITEMS = TIME_ALLOCATION_QUESTION.strategicItems || [];
const OPERATIONAL_TIME_ITEMS = TIME_ALLOCATION_QUESTION.operationalItems || [];
const ALL_TIME_ITEMS = [...STRATEGIC_TIME_ITEMS, ...OPERATIONAL_TIME_ITEMS];
const IS_RETAKE = new URLSearchParams(window.location.search).get('retake') === '1';

const clampPercent = value => {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(100, Math.round(number * 10) / 10));
};

function summarizeTimeAllocation(rawAllocations = {}) {
  const allocations = Object.fromEntries(
    ALL_TIME_ITEMS.map(item => [item, clampPercent(rawAllocations?.[item])]),
  );
  const strategic = Math.round(
    STRATEGIC_TIME_ITEMS.reduce((sum, item) => sum + allocations[item], 0) * 10,
  ) / 10;
  const operational = Math.round(
    OPERATIONAL_TIME_ITEMS.reduce((sum, item) => sum + allocations[item], 0) * 10,
  ) / 10;
  const total = Math.round((strategic + operational) * 10) / 10;
  return { allocations, strategic, operational, total };
}

const DEFAULT_ANSWERS = {
  24: { strategic: 0, operational: 0, total: 0, allocations: {} },
  25: {
    Sales: 50,
    'Client Delivery': 50,
    Leadership: 50,
    Marketing: 50,
    Hiring: 50,
    Finance: 50,
  },
};

function calculateScores(answers) {
  const categoryDetails = {};
  CATEGORIES.forEach(cat => {
    const catQs = QUESTIONS.filter(q => q.category === cat.id);
    if (cat.id === 'strategic') {
      const timeAllocation = summarizeTimeAllocation(answers[24]?.allocations || {});
      const stratPct = timeAllocation.strategic;
      const matrixObj = answers[25] || {};
      const matrixVals = Object.values(matrixObj);
      const matrixAvg = matrixVals.length ? matrixVals.reduce((a, b) => a + b, 0) / matrixVals.length : 50;
      const rawScore = (stratPct + matrixAvg) / 2;
      categoryDetails[cat.id] = { categoryScore: Math.round(rawScore) };
    } else {
      const maxPoints = catQs.length * 4;
      const scoredPoints = catQs.reduce((sum, q) => sum + (answers[q.id] !== undefined ? answers[q.id] : 0), 0);
      categoryDetails[cat.id] = { categoryScore: Math.round(maxPoints ? (scoredPoints / maxPoints) * 100 : 0) };
    }
  });
  const overallIndexScore = Math.round(CATEGORIES.reduce((sum, cat) => sum + categoryDetails[cat.id].categoryScore, 0) / CATEGORIES.length);
  const validationAnswer = answers[26];
  const validationScore = validationAnswer === undefined ? null : validationAnswer * 25;
  const mismatch = validationScore === null ? null : Math.abs(validationScore - overallIndexScore);
  let validationStatus = 'Needs Validation';
  let confidenceScore = 60;
  if (mismatch !== null && mismatch > 30) {
    validationStatus = 'Significant Contradiction';
    confidenceScore = Math.max(35, Math.round(60 - (mismatch - 30)));
  } else if (mismatch !== null && mismatch > 15) {
    confidenceScore = Math.max(45, Math.round(60 - (mismatch - 15) * 0.6));
  }
  const timeAllocation = summarizeTimeAllocation(answers[24]?.allocations || {});
  const ownerTime = {
    salesPercent: timeAllocation.allocations.Sales ?? 0,
    deliveryPercent: timeAllocation.allocations.Delivery ?? 0,
    clientManagementPercent: timeAllocation.allocations['Client Management'] ?? 0,
    strategicPercent: timeAllocation.strategic,
    operationalPercent: timeAllocation.operational,
    totalPercent: timeAllocation.total,
    period: 'last_30_days',
    source: 'owner_reported_time_allocation'
  };

  return {
    categoryDetails,
    overallIndexScore,
    validationAnswer,
    validationScore,
    mismatch,
    validationStatus,
    confidenceScore,
    ownerTime,
    timeAllocation
  };
}

export default function App() {
  const [currentIdx, setCurrentIdx] = useState(() => {
    if (IS_RETAKE) return 0;
    const saved = Number(localStorage.getItem('ccIndependenceCurrentQuestion'));
    return Number.isFinite(saved) && saved >= 0 && saved < QUESTIONS.length ? saved : 0;
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [answers, setAnswers] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('ccIndependenceAnswers') || '{}');
      const merged = { ...DEFAULT_ANSWERS, ...saved };
      const savedAllocations = saved?.[24]?.allocations;
      // Older builds stored only a Strategic/Operational split. That is not
      // enough to recover Sales or Delivery time, so do not fabricate those
      // values. The owner must complete the detailed allocation once.
      merged[24] = savedAllocations && typeof savedAllocations === 'object'
        ? summarizeTimeAllocation(savedAllocations)
        : { strategic: 0, operational: 0, total: 0, allocations: {} };
      return merged;
    } catch {
      return { ...DEFAULT_ANSWERS };
    }
  });

  const currentQuestion = QUESTIONS[currentIdx];
  const totalQuestions = QUESTIONS.length;
  const activeCategory = currentQuestion.category;
  const activeCatIndex = CATEGORIES.findIndex(cat => cat.id === activeCategory);
  const isValidation = activeCategory === 'validation';

  const isQuestionAnswered = q => {
    if (q.type === 'strategic-sliders') {
      return Math.abs(Number(answers[24]?.total || 0) - 100) < 0.001;
    }
    if (q.type === 'activity-matrix') return true;
    return answers[q.id] !== undefined;
  };
  const currentAnswered = isQuestionAnswered(currentQuestion);
  const progressPct = Math.round((currentIdx / totalQuestions) * 100);

  useEffect(() => {
    localStorage.setItem('ccIndependenceAnswers', JSON.stringify(answers));
    localStorage.setItem('ccIndependenceCurrentQuestion', String(currentIdx));
    const answered = QUESTIONS.filter(isQuestionAnswered).length;
    const progress = Math.min(99, Math.round((answered / QUESTIONS.length) * 100));
    localStorage.setItem('ccIndexIndependenceProgress', String(progress));
    window.CCDiagnostic?.setProgress?.('independence', progress);
  }, [answers, currentIdx]);

  const categoryProgress = catId => {
    const qs = QUESTIONS.filter(q => q.category === catId);
    return { answered: qs.filter(isQuestionAnswered).length, total: qs.length };
  };

  const setChoice = score => setAnswers(prev => ({ ...prev, [currentQuestion.id]: score }));
  const handleTimeAllocation = (activity, value) => {
    setAnswers(prev => {
      const currentAllocations = prev?.[24]?.allocations || {};
      const nextAllocations = {
        ...currentAllocations,
        [activity]: clampPercent(value)
      };
      return { ...prev, 24: summarizeTimeAllocation(nextAllocations) };
    });
  };
  const handleMatrix = (activity, score) => setAnswers(prev => ({ ...prev, 25: { ...(prev[25] || {}), [activity]: score } }));

  const finish = async () => {
    if (isSaving) return;
    const scores = calculateScores(answers);
    if (Math.abs(scores.ownerTime.totalPercent - 100) >= 0.001) {
      const allocationIndex = QUESTIONS.findIndex(q => q.id === 24);
      if (allocationIndex >= 0) setCurrentIdx(allocationIndex);
      return;
    }

    setIsSaving(true);
    setSaveError('');

    try {
      window.CCDiagnostic?.mark?.('independence', scores.overallIndexScore, {
        answers,
        scores,
        ownerTime: scores.ownerTime,
        timeAllocation: scores.timeAllocation,
        retakenAt: IS_RETAKE ? new Date().toISOString() : null
      });

      if (!window.CCDiagnostic) {
        localStorage.setItem('ownerIndependenceScore', String(scores.overallIndexScore));
        localStorage.setItem('ccIndexIndependenceComplete', 'true');
        localStorage.setItem('ccIndexIndependenceProgress', '100');
        location.href = '/diagnostic/';
        return;
      }

      // Wait for the updated Independence row to reach Supabase before the
      // scorecard is regenerated. The previous implementation navigated away
      // immediately after mark(), which could cancel the background request.
      if (window.CCAccount?.syncDiagnosticState) {
        await window.CCAccount.syncDiagnosticState(
          window.CCDiagnostic.serialize(),
          { throwOnError: true }
        );
      }

      const state = window.CCDiagnostic.getState?.() || {};
      if (state.allComplete && window.CCScorecard?.generate) {
        window.CCScorecard.clear?.();
        await window.CCScorecard.generate();

        // Mark the newly generated snapshot ready only after the database
        // scorecard has been upserted successfully.
        window.CCDiagnostic.completeReportGeneration?.();
        if (window.CCAccount?.syncDiagnosticState) {
          await window.CCAccount.syncDiagnosticState(
            window.CCDiagnostic.serialize(),
            { throwOnError: true }
          );
        }
        location.href = '/agency-scorecard/?updated=independence';
        return;
      }

      location.href = '/diagnostic/?updated=independence';
    } catch (error) {
      console.error('Owner Independence retake could not be saved.', error);
      setSaveError(error?.message || 'Your updated assessment could not be saved. Please try again.');
      setIsSaving(false);
    }
  };

  const next = () => currentIdx < totalQuestions - 1 ? setCurrentIdx(i => i + 1) : void finish();
  const back = () => currentIdx > 0 && setCurrentIdx(i => i - 1);
  const categoryColor = isValidation ? '#d97706' : '#2563eb';

  return (
    <div className="app-wrapper independence-strength-ui">
      <header className="top-header">
        <div className="main-container flex items-center justify-between">
          <button onClick={() => { location.href = '/diagnostic/'; }} className="btn-back">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
            Back to diagnostic hub
          </button>
        </div>
      </header>

      <div className="main-container">
        <div className="diagnostic-shell">
          <aside className="sidebar-container">
            <div>
              <div className="index-eyebrow">INDEPENDENCE</div>
              <h1 className="sidebar-brand-title">Owner<br />Independence Index</h1>
            </div>
            <nav className="sidebar-nav-list">
              {CATEGORIES.map((cat, idx) => {
                const p = categoryProgress(cat.id);
                const done = p.answered === p.total;
                const active = cat.id === activeCategory;
                const firstIndex = QUESTIONS.findIndex(q => q.category === cat.id);
                const canClick = idx <= activeCatIndex || p.answered > 0 || isValidation;
                return (
                  <button key={cat.id} onClick={() => canClick && setCurrentIdx(firstIndex)} className={`sidebar-nav-button ${active ? 'active' : ''}`} style={{ cursor: canClick ? 'pointer' : 'default', opacity: canClick ? 1 : .7 }}>
                    <span>{cat.name}</span>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active || done ? '#10b981' : '#cbd5e1'} strokeWidth="2"><circle cx="12" cy="12" r="9" />{(active || done) && <path d="M8 12l3 3 5-5" strokeWidth="2.5" stroke="#10b981" />}</svg>
                  </button>
                );
              })}
              <button onClick={() => setCurrentIdx(QUESTIONS.length - 1)} className={`sidebar-nav-button ${isValidation ? 'active validation-active' : ''}`}>
                <span>Validation</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={answers[26] !== undefined ? '#10b981' : '#cbd5e1'} strokeWidth="2"><circle cx="12" cy="12" r="9" />{answers[26] !== undefined && <path d="M8 12l3 3 5-5" strokeWidth="2.5" stroke="#10b981" />}</svg>
              </button>
            </nav>
          </aside>

          <main className="index-question-main">
            <div className="question-progress-row">
              <span className="question-category" style={{ color: categoryColor }}>{isValidation ? 'Validation' : CATEGORIES.find(c => c.id === activeCategory)?.name}</span>
              <div className="question-progress-track"><span style={{ width: `${progressPct}%` }} /></div>
              <span className="question-counter">Question {currentIdx + 1} of {totalQuestions}</span>
            </div>

            <section className="q-card fade-in">
              {isValidation && <div className="question-badge-wrap"><span className="question-badge validation">⌁ Validation Question</span></div>}
              <div className="question-title-wrap">
                <h2>{currentQuestion.text}</h2>
                {currentQuestion.subtitle && <p>{currentQuestion.subtitle}</p>}
              </div>

              {currentQuestion.type === 'choice' && (
                <div className="question-options">
                  {currentQuestion.options.map((option, idx) => {
                    const selected = answers[currentQuestion.id] === option.score;
                    return (
                      <button key={`${currentQuestion.id}-${idx}`} type="button" className={`radio-option-card ${selected ? 'selected' : ''}`} onClick={() => setChoice(option.score)}>
                        <span className="option-left"><i className="option-letter">{String.fromCharCode(65 + idx)}</i><b>{option.label}</b></span>
                        <span className="radio-indicator">{selected && <i />}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {currentQuestion.type === 'strategic-sliders' && (
                <div className="special-question-body">
                  <div className="time-allocation-summary">
                    <div>
                      <span>Strategic Work</span>
                      <strong>{answers[24]?.strategic ?? 0}%</strong>
                    </div>
                    <div>
                      <span>Operational Work</span>
                      <strong>{answers[24]?.operational ?? 0}%</strong>
                    </div>
                    <div className={`allocation-total ${Math.abs(Number(answers[24]?.total || 0) - 100) < 0.001 ? 'complete' : 'incomplete'}`}>
                      <span>Total allocation</span>
                      <strong>{answers[24]?.total ?? 0}%</strong>
                      <small>{Math.abs(Number(answers[24]?.total || 0) - 100) < 0.001 ? 'Ready to continue' : 'Must equal 100%'}</small>
                    </div>
                  </div>

                  <div className="time-allocation-groups">
                    <section className="time-allocation-card strategic">
                      <header>
                        <div>
                          <span>Strategic Work</span>
                          <small>Owner time spent building, leading, and allocating.</small>
                        </div>
                        <strong>{answers[24]?.strategic ?? 0}%</strong>
                      </header>
                      <div className="time-allocation-list">
                        {currentQuestion.strategicItems.map(item => (
                          <label className="time-allocation-row" key={item}>
                            <span>{item}</span>
                            <span className="percent-input">
                              <input
                                type="number"
                                inputMode="decimal"
                                min="0"
                                max="100"
                                step="1"
                                value={answers[24]?.allocations?.[item] ?? ''}
                                placeholder="0"
                                onChange={e => handleTimeAllocation(item, e.target.value)}
                              />
                              <b>%</b>
                            </span>
                          </label>
                        ))}
                      </div>
                    </section>

                    <section className="time-allocation-card operational">
                      <header>
                        <div>
                          <span>Operational Work</span>
                          <small>Owner time spent directly operating the agency.</small>
                        </div>
                        <strong>{answers[24]?.operational ?? 0}%</strong>
                      </header>
                      <div className="time-allocation-list">
                        {currentQuestion.operationalItems.map(item => (
                          <label className="time-allocation-row" key={item}>
                            <span>{item}</span>
                            <span className="percent-input">
                              <input
                                type="number"
                                inputMode="decimal"
                                min="0"
                                max="100"
                                step="1"
                                value={answers[24]?.allocations?.[item] ?? ''}
                                placeholder="0"
                                onChange={e => handleTimeAllocation(item, e.target.value)}
                              />
                              <b>%</b>
                            </span>
                          </label>
                        ))}
                      </div>
                    </section>
                  </div>

                  <p className="time-allocation-help">
                    Enter the percentage of your time spent on each activity over the last 30 days.
                    All activities together must equal 100%. Sales and Delivery are saved as separate
                    owner-dependency metrics for Agency Goals.
                  </p>
                </div>
              )}

              {currentQuestion.type === 'activity-matrix' && (
                <div className="special-question-body matrix-scroll">
                  <table className="activity-matrix"><thead><tr><th>Activity</th>{currentQuestion.matrixOptions.map(opt => <th key={opt.label}>{opt.label}</th>)}</tr></thead><tbody>{currentQuestion.activities.map(activity => <tr key={activity}><td>{activity}</td>{currentQuestion.matrixOptions.map(opt => { const selected=(answers[25]?.[activity] ?? 50)===opt.score; return <td key={opt.label}><button type="button" className={`matrix-radio ${selected?'selected':''}`} onClick={() => handleMatrix(activity,opt.score)}>{selected && <span />}</button></td>; })}</tr>)}</tbody></table>
                </div>
              )}

              <div className="question-card-divider" />
              {saveError && <p style={{ color: '#b91c1c', margin: '0 0 12px', fontSize: '14px' }}>{saveError}</p>}
              <div className="question-card-actions">
                {currentIdx > 0 ? <button className="btn-back" disabled={isSaving} onClick={back}>← Back</button> : <span />}
                <button className={`btn-next ${currentAnswered && !isSaving ? 'active' : 'disabled'}`} disabled={!currentAnswered || isSaving} onClick={next}>{isSaving ? (IS_RETAKE ? 'Saving & regenerating…' : 'Saving…') : (currentIdx === totalQuestions - 1 ? (IS_RETAKE ? 'Save & regenerate report' : 'Save & finish') : 'Next')} {!isSaving && <span>→</span>}</button>
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}