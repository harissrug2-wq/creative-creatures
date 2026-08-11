import React, { useEffect, useState } from 'react';
import { CATEGORIES, QUESTIONS } from './questionsData.js';

const DEFAULT_ANSWERS = {
  24: { strategic: 50, operational: 50 },
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
      const stratPct = answers[24]?.strategic ?? 50;
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
  return { categoryDetails, overallIndexScore, validationAnswer, validationScore, mismatch, validationStatus, confidenceScore };
}

export default function App() {
  const [currentIdx, setCurrentIdx] = useState(() => {
    const saved = Number(localStorage.getItem('ccIndependenceCurrentQuestion'));
    return Number.isFinite(saved) && saved >= 0 && saved < QUESTIONS.length ? saved : 0;
  });
  const [answers, setAnswers] = useState(() => {
    try { return { ...DEFAULT_ANSWERS, ...JSON.parse(localStorage.getItem('ccIndependenceAnswers') || '{}') }; }
    catch { return { ...DEFAULT_ANSWERS }; }
  });

  const currentQuestion = QUESTIONS[currentIdx];
  const totalQuestions = QUESTIONS.length;
  const activeCategory = currentQuestion.category;
  const activeCatIndex = CATEGORIES.findIndex(cat => cat.id === activeCategory);
  const isValidation = activeCategory === 'validation';

  const isQuestionAnswered = q => {
    if (q.type === 'strategic-sliders' || q.type === 'activity-matrix') return true;
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
  const handleStrategicSlider = value => {
    const strategic = Math.min(100, Math.max(0, Number(value) || 0));
    setAnswers(prev => ({ ...prev, 24: { strategic, operational: 100 - strategic } }));
  };
  const handleMatrix = (activity, score) => setAnswers(prev => ({ ...prev, 25: { ...(prev[25] || {}), [activity]: score } }));

  const finish = () => {
    const scores = calculateScores(answers);
    window.CCDiagnostic?.mark?.('independence', scores.overallIndexScore, { answers, scores });
    if (!window.CCDiagnostic) {
      localStorage.setItem('ownerIndependenceScore', String(scores.overallIndexScore));
      localStorage.setItem('ccIndexIndependenceComplete', 'true');
      localStorage.setItem('ccIndexIndependenceProgress', '100');
    }
    location.href = '/diagnostic/';
  };

  const next = () => currentIdx < totalQuestions - 1 ? setCurrentIdx(i => i + 1) : finish();
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
                  <div className="allocation-grid">
                    <section><span>Strategic Work</span><strong>{answers[24]?.strategic ?? 50}%</strong><ul>{currentQuestion.strategicItems.map(item => <li key={item}>{item}</li>)}</ul></section>
                    <section><span>Operational Work</span><strong>{answers[24]?.operational ?? 50}%</strong><ul>{currentQuestion.operationalItems.map(item => <li key={item}>{item}</li>)}</ul></section>
                  </div>
                  <div className="slider-labels"><span>100% Operational</span><span>100% Strategic</span></div>
                  <input className="allocation-slider" type="range" min="0" max="100" value={answers[24]?.strategic ?? 50} onChange={e => handleStrategicSlider(e.target.value)} />
                </div>
              )}

              {currentQuestion.type === 'activity-matrix' && (
                <div className="special-question-body matrix-scroll">
                  <table className="activity-matrix"><thead><tr><th>Activity</th>{currentQuestion.matrixOptions.map(opt => <th key={opt.label}>{opt.label}</th>)}</tr></thead><tbody>{currentQuestion.activities.map(activity => <tr key={activity}><td>{activity}</td>{currentQuestion.matrixOptions.map(opt => { const selected=(answers[25]?.[activity] ?? 50)===opt.score; return <td key={opt.label}><button type="button" className={`matrix-radio ${selected?'selected':''}`} onClick={() => handleMatrix(activity,opt.score)}>{selected && <span />}</button></td>; })}</tr>)}</tbody></table>
                </div>
              )}

              <div className="question-card-divider" />
              <div className="question-card-actions">
                {currentIdx > 0 ? <button className="btn-back" onClick={back}>← Back</button> : <span />}
                <button className={`btn-next ${currentAnswered ? 'active' : 'disabled'}`} disabled={!currentAnswered} onClick={next}>{currentIdx === totalQuestions - 1 ? 'Save & finish' : 'Next'} <span>→</span></button>
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}