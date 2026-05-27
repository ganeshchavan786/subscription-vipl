import React, { useState, useRef, useEffect } from 'react';

/**
 * SearchableSelect — dropdown with search + optional quick-add
 * Props:
 *   options      : [{ id, label, sub }]
 *   value        : selected id (string)
 *   onChange     : (id) => void
 *   placeholder  : string
 *   onQuickAdd   : (name) => Promise<{id, label}> — optional
 *   quickAddLabel: string — e.g. "Add Customer"
 */
export default function SearchableSelect({
  options = [],
  value,
  onChange,
  placeholder = 'Search...',
  onQuickAdd,
  quickAddLabel = 'Add New',
}) {
  const [open, setOpen]       = useState(false);
  const [query, setQuery]     = useState('');
  const [adding, setAdding]   = useState(false);
  const [addName, setAddName] = useState('');
  const [addErr, setAddErr]   = useState('');
  const wrapRef = useRef();
  const inputRef = useRef();

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  const selected = options.find(o => String(o.id) === String(value));

  const filtered = query.trim()
    ? options.filter(o =>
        o.label.toLowerCase().includes(query.toLowerCase()) ||
        (o.sub && o.sub.toLowerCase().includes(query.toLowerCase()))
      )
    : options;

  const handleSelect = (id) => {
    onChange(id);
    setOpen(false);
    setQuery('');
  };

  const handleQuickAdd = async () => {
    if (!addName.trim()) { setAddErr('Name required.'); return; }
    setAdding(true); setAddErr('');
    try {
      const result = await onQuickAdd(addName.trim());
      onChange(String(result.id));
      setOpen(false);
      setQuery('');
      setAddName('');
    } catch(e) {
      setAddErr(e.response?.data?.message || 'Failed to add.');
    } finally { setAdding(false); }
  };

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      {/* Trigger button */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'var(--surface)', border: '1px solid var(--border2)',
          borderRadius: 'var(--r)', padding: '0.6rem 0.85rem',
          cursor: 'pointer', minHeight: 40,
          transition: 'border-color 0.15s',
          borderColor: open ? 'var(--accent)' : undefined,
          boxShadow: open ? '0 0 0 3px var(--accent-dim)' : undefined,
        }}
      >
        <span style={{
          fontSize: '0.875rem',
          color: selected ? 'var(--text)' : 'var(--text3)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
        }}>
          {selected ? selected.label : placeholder}
        </span>
        <span style={{ color: 'var(--text3)', fontSize: '0.75rem', marginLeft: 6, flexShrink: 0 }}>
          {open ? '▲' : '▼'}
        </span>
      </div>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          background: 'var(--surface)', border: '1px solid var(--border2)',
          borderRadius: 'var(--r)', zIndex: 500,
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          maxHeight: 280, display: 'flex', flexDirection: 'column',
        }}>
          {/* Search input */}
          <div style={{ padding: '0.5rem', borderBottom: '1px solid var(--border)' }}>
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Type to search..."
              style={{
                width: '100%', border: '1px solid var(--border2)',
                borderRadius: 6, padding: '0.45rem 0.7rem',
                fontSize: '0.85rem', outline: 'none',
                background: 'var(--surface2)', color: 'var(--text)',
              }}
              onFocus={e => e.target.style.borderColor = 'var(--accent)'}
              onBlur={e => e.target.style.borderColor = 'var(--border2)'}
            />
          </div>

          {/* Options list */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {filtered.length === 0 && !onQuickAdd && (
              <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text3)', fontSize: '0.85rem' }}>
                No results found
              </div>
            )}
            {filtered.map(o => (
              <div
                key={o.id}
                onClick={() => handleSelect(String(o.id))}
                style={{
                  padding: '0.55rem 0.85rem', cursor: 'pointer',
                  background: String(o.id) === String(value) ? 'var(--accent-dim)' : 'transparent',
                  borderLeft: String(o.id) === String(value) ? '3px solid var(--accent)' : '3px solid transparent',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => { if (String(o.id) !== String(value)) e.currentTarget.style.background = 'var(--surface2)'; }}
                onMouseLeave={e => { if (String(o.id) !== String(value)) e.currentTarget.style.background = 'transparent'; }}
              >
                <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)' }}>{o.label}</div>
                {o.sub && <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginTop: 1 }}>{o.sub}</div>}
              </div>
            ))}

            {/* Quick Add section */}
            {onQuickAdd && filtered.length === 0 && (
              <div style={{ padding: '0.65rem 0.85rem', borderTop: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text3)', marginBottom: '0.4rem' }}>
                  "{query || 'New'}" not found —
                </div>
                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                  <input
                    value={addName || query}
                    onChange={e => setAddName(e.target.value)}
                    placeholder={`${quickAddLabel} name...`}
                    style={{
                      flex: 1, border: '1px solid var(--border2)', borderRadius: 6,
                      padding: '0.4rem 0.6rem', fontSize: '0.82rem',
                      outline: 'none', background: 'var(--surface2)', color: 'var(--text)',
                    }}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleQuickAdd(); } }}
                  />
                  <button
                    type="button"
                    onClick={handleQuickAdd}
                    disabled={adding}
                    style={{
                      background: 'var(--accent)', color: 'white', border: 'none',
                      borderRadius: 6, padding: '0.4rem 0.75rem',
                      fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                      whiteSpace: 'nowrap', opacity: adding ? 0.6 : 1,
                    }}
                  >
                    {adding ? '...' : `+ ${quickAddLabel}`}
                  </button>
                </div>
                {addErr && <div style={{ fontSize: '0.75rem', color: 'var(--red)', marginTop: '0.3rem' }}>{addErr}</div>}
              </div>
            )}

            {/* Quick Add button when results exist */}
            {onQuickAdd && filtered.length > 0 && (
              <div
                style={{
                  padding: '0.5rem 0.85rem', borderTop: '1px solid var(--border)',
                  cursor: 'pointer', color: 'var(--accent)', fontSize: '0.82rem', fontWeight: 600,
                }}
                onClick={() => { setQuery(''); setAddName(''); setOpen(false);
                  // trigger parent quick add modal
                  onQuickAdd('__OPEN_MODAL__');
                }}
              >
                + {quickAddLabel}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
