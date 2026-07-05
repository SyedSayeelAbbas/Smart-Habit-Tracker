import { useState } from "react";
import { Sparkles, Check, RefreshCw, AlertCircle } from "lucide-react";
import Modal from "./Modal.jsx";
import api from "../api/axios.js";

export default function HabitSuggestionModal({ open, onClose, onAccept }) {
  const [step, setStep] = useState(0);
  const [goals, setGoals] = useState("");
  const [productiveTime, setProductiveTime] = useState("");
  const [struggles, setStruggles] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [added, setAdded] = useState(new Set());
  const [adding, setAdding] = useState({});
  const [error, setError] = useState(null);

  const reset = () => {
    setStep(0);
    setGoals("");
    setProductiveTime("");
    setStruggles("");
    setSuggestions([]);
    setAdded(new Set());
    setAdding({});
    setError(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const submit = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post("/ai/suggest-habits", {
        goals,
        productiveTime,
        struggles,
      });
      setSuggestions(res.data.suggestions || []);
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to get suggestions. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const accept = async (s, idx) => {
    if (added.has(idx) || adding[idx]) return;
    setAdding((prev) => ({ ...prev, [idx]: true }));
    setError(null);
    try {
      await onAccept(s);
      setAdded((prev) => new Set(prev).add(idx));
    } catch (err) {
      setError(err.response?.data?.message || "Could not add this habit. Please try again.");
    } finally {
      setAdding((prev) => ({ ...prev, [idx]: false }));
    }
  };

  return (
    <Modal open={open} onClose={close} title="AI Habit Suggestions" maxWidth="max-w-xl">
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-500 text-sm flex items-center gap-2">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {step === 0 && (
        <div className="space-y-4">
          <div className="text-sm text-soft">
            Answer 3 quick questions and I'll suggest 3 personalised habits.
          </div>
          <div>
            <label className="label">What are your goals right now?</label>
            <textarea
              className="input resize-none"
              rows={3}
              placeholder="e.g. Get fitter, read more, reduce phone time..."
              value={goals}
              onChange={(e) => setGoals(e.target.value)}
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2">
            <button className="btn-secondary" onClick={close}>Cancel</button>
            <button className="btn-primary" onClick={() => setStep(1)} disabled={!goals.trim()}>
              Next
            </button>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <div>
            <label className="label">When are you most productive during the day?</label>
            <textarea
              className="input resize-none"
              rows={3}
              placeholder="e.g. Early morning, late evenings..."
              value={productiveTime}
              onChange={(e) => setProductiveTime(e.target.value)}
              autoFocus
            />
          </div>
          <div className="flex justify-between gap-2">
            <button className="btn-ghost" onClick={() => setStep(0)}>Back</button>
            <button className="btn-primary" onClick={() => setStep(2)} disabled={!productiveTime.trim()}>
              Next
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div>
            <label className="label">What habits have you struggled with?</label>
            <textarea
              className="input resize-none"
              rows={3}
              placeholder="e.g. Gym in the morning, journaling at night..."
              value={struggles}
              onChange={(e) => setStruggles(e.target.value)}
              autoFocus
            />
          </div>
          <div className="flex justify-between gap-2">
            <button className="btn-ghost" onClick={() => setStep(1)}>Back</button>
            <button
              className="btn-primary"
              onClick={submit}
              disabled={loading || !struggles.trim()}
            >
              {loading ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  Thinking...
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  Get suggestions
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-3">
          {suggestions.length === 0 && (
            <div className="text-sm text-muted">No suggestions returned. Try again.</div>
          )}
          {suggestions.map((s, i) => {
            const isAdded = added.has(i);
            const isAdding = adding[i];
            return (
              <div key={i} className="glass rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-xl">{s.icon}</span>
                  <div className="font-medium">{s.name}</div>
                  <span className="chip">{s.category}</span>
                  <span className="chip">{s.frequency}</span>
                </div>
                <div className="text-sm text-soft">{s.description}</div>
                {s.reason && (
                  <div className="text-xs text-brand-700 dark:text-brand-300 mt-2 bg-brand-500/10 rounded-lg px-2 py-1.5">
                    Why: {s.reason}
                  </div>
                )}
                <div className="mt-3 flex justify-end">
                  {isAdded ? (
                    <div className="text-sm text-emerald-500 flex items-center gap-1">
                      <Check size={14} /> Added
                    </div>
                  ) : (
                    <button
                      className="btn-primary"
                      onClick={() => accept(s, i)}
                      disabled={isAdding}
                    >
                      {isAdding ? (
                        <>
                          <RefreshCw size={14} className="animate-spin" />
                          Adding...
                        </>
                      ) : (
                        "Add this habit"
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          <div className="flex justify-end">
            <button className="btn-secondary" onClick={close}>Done</button>
          </div>
        </div>
      )}
    </Modal>
  );
}