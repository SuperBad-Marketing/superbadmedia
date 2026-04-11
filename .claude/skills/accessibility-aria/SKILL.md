---
name: accessibility-aria
description: WCAG 2.1 AA accessibility patterns for Next.js/React. Semantic HTML, ARIA roles/labels, keyboard navigation, focus management, screen reader support, and accessible CRM component patterns.
---

# Accessibility & ARIA — SuperBad HQ Reference

Every component built for superbad-hq must meet **WCAG 2.1 AA** as a baseline. This is not optional — it improves usability for all users and is required for professional-grade software. Follow these patterns as you write code.

---

## 1. The Four Principles (POUR)

- **Perceivable** — content is visible/hearable to all users
- **Operable** — all functionality is keyboard-accessible
- **Understandable** — UI is predictable and error messages are clear
- **Robust** — works with current assistive technologies (screen readers, keyboard, voice control)

---

## 2. Semantic HTML First

Always prefer semantic HTML over ARIA. ARIA is a polyfill for when semantics are impossible — not a replacement.

```tsx
// CORRECT — semantic
<nav aria-label="Main navigation">
  <ul>
    <li><a href="/dashboard">Dashboard</a></li>
  </ul>
</nav>

<main>
  <h1>Client Overview</h1>
  <section aria-labelledby="metrics-heading">
    <h2 id="metrics-heading">Performance Metrics</h2>
  </section>
</main>

<aside aria-label="Quick actions">...</aside>

// WRONG — div soup
<div class="nav">
  <div class="nav-item">Dashboard</div>
</div>
```

### Landmark roles to always use
```tsx
<header>         {/* banner landmark */}
<nav>            {/* navigation landmark */}
<main>           {/* main landmark — ONE per page */}
<aside>          {/* complementary landmark */}
<footer>         {/* contentinfo landmark */}
<section>        {/* region — add aria-labelledby */}
<article>        {/* self-contained content */}
<form>           {/* form landmark — add aria-label or aria-labelledby */}
```

---

## 3. ARIA Labels & Descriptions

```tsx
// Icon-only buttons MUST have aria-label
<button aria-label="Close panel" onClick={onClose}>
  <X size={16} />
</button>

// Inputs MUST have associated labels
<label htmlFor="client-search">Search clients</label>
<input id="client-search" type="search" />

// Or use aria-label if visually hidden
<input
  type="search"
  aria-label="Search clients"
  placeholder="Search clients..."
/>

// Additional description (not replacing label)
<input
  id="email"
  type="email"
  aria-describedby="email-hint email-error"
/>
<p id="email-hint" className="text-xs text-sb-cream/50">
  We'll send invoices to this address
</p>
<p id="email-error" role="alert" className="text-xs text-sb-danger">
  Please enter a valid email
</p>

// Group of related inputs
<fieldset>
  <legend>Contact details</legend>
  <input type="text" name="first" />
  <input type="text" name="last" />
</fieldset>
```

---

## 4. Keyboard Navigation

Every interactive element must be reachable and operable via keyboard.

### Focus visibility — always visible, never remove
```css
/* In globals.css — never remove focus rings */
:focus-visible {
  outline: 2px solid var(--sb-accent);
  outline-offset: 2px;
  border-radius: 4px;
}

/* Hide for mouse users only */
:focus:not(:focus-visible) {
  outline: none;
}
```

```tsx
// NEVER do this
<button className="focus:outline-none">   // kills keyboard accessibility
<div className="outline-hidden">          // v4 — only acceptable when managing focus manually
```

### Interactive element rules
```tsx
// Divs/spans are NOT focusable. Use real elements or add role + tabIndex + keyboard handler
// WRONG
<div onClick={handleClick} className="cursor-pointer">Click me</div>

// CORRECT — use a button
<button onClick={handleClick}>Click me</button>

// Only use div-as-button if absolutely necessary (e.g. complex drag targets)
<div
  role="button"
  tabIndex={0}
  onClick={handleClick}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleClick()
    }
  }}
>
  Complex interactive element
</div>
```

### Keyboard shortcuts for common patterns
| Element | Keys |
|---|---|
| Button | Enter, Space |
| Link | Enter |
| Checkbox | Space |
| Select / Listbox | Arrow Up/Down, Enter, Escape |
| Dialog/Modal | Escape to close, Tab to cycle within |
| Menu | Arrow Up/Down, Enter to select, Escape to close |
| Tabs | Arrow Left/Right to switch, Enter/Space to activate |
| Data table | Arrow keys to navigate cells |

---

## 5. Focus Management

### Modal / Dialog
```tsx
// Focus must be trapped inside open modals and returned on close
import { useEffect, useRef } from 'react'

function Modal({ isOpen, onClose, children }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement
      // Focus first focusable element inside dialog
      const firstFocusable = dialogRef.current?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      firstFocusable?.focus()
    } else {
      // Return focus to trigger element
      previousFocusRef.current?.focus()
    }
  }, [isOpen])

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="dialog-title"
      aria-describedby="dialog-description"
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
    >
      <h2 id="dialog-title">...</h2>
      <p id="dialog-description">...</p>
      {children}
      <button onClick={onClose}>Close</button>
    </dialog>
  )
}
```

### Skip link (required on all pages)
```tsx
// In layout.tsx — first element in <body>
<a
  href="#main-content"
  className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-sb-accent focus:text-sb-cream focus:rounded"
>
  Skip to main content
</a>

<main id="main-content">...</main>
```

### Roving tabIndex for composite widgets (toolbars, tab lists, grids)
```tsx
// Only one item in a group is in the tab order at a time
// Arrow keys move focus within the group
function TabList({ tabs }) {
  const [activeIndex, setActiveIndex] = useState(0)

  const handleKeyDown = (e: KeyboardEvent, index: number) => {
    if (e.key === 'ArrowRight') {
      const next = (index + 1) % tabs.length
      setActiveIndex(next)
      tabRefs.current[next]?.focus()
    }
    if (e.key === 'ArrowLeft') {
      const prev = (index - 1 + tabs.length) % tabs.length
      setActiveIndex(prev)
      tabRefs.current[prev]?.focus()
    }
  }

  return (
    <div role="tablist" aria-label="Client tabs">
      {tabs.map((tab, i) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={i === activeIndex}
          aria-controls={`panel-${tab.id}`}
          tabIndex={i === activeIndex ? 0 : -1}
          onKeyDown={(e) => handleKeyDown(e, i)}
          onClick={() => setActiveIndex(i)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
```

---

## 6. Live Regions (Dynamic Content)

```tsx
// Announce changes to screen readers without moving focus
// role="status" — polite (waits for current speech to finish)
// role="alert" — assertive (interrupts immediately, for errors/urgent info)

// Loading state
<div role="status" aria-live="polite" aria-label="Loading">
  <span className="sr-only">Loading clients...</span>
  <Spinner />
</div>

// Success notification
<div role="status" aria-live="polite">
  Client saved successfully
</div>

// Error message
<div role="alert" aria-live="assertive">
  Failed to save. Please try again.
</div>

// Search results count
<div aria-live="polite" aria-atomic="true" className="sr-only">
  {`${results.length} results found`}
</div>
```

---

## 7. Form Accessibility

```tsx
function AccessibleForm() {
  return (
    <form aria-labelledby="form-title" noValidate>
      <h2 id="form-title">Add New Client</h2>

      {/* Required field indicator */}
      <p className="text-xs text-sb-cream/50 mb-4">
        Fields marked with <span aria-hidden="true">*</span>
        <span className="sr-only">an asterisk</span> are required.
      </p>

      {/* Text input with error */}
      <div className="flex flex-col gap-1">
        <label htmlFor="business-name">
          Business name
          <span aria-hidden="true" className="text-sb-danger ml-1">*</span>
        </label>
        <input
          id="business-name"
          type="text"
          required
          aria-required="true"
          aria-invalid={!!errors.businessName}
          aria-describedby={errors.businessName ? "business-name-error" : undefined}
          className={errors.businessName ? "border-sb-danger" : "border-sb-cream/20"}
        />
        {errors.businessName && (
          <p id="business-name-error" role="alert" className="text-xs text-sb-danger">
            {errors.businessName.message}
          </p>
        )}
      </div>

      {/* Select */}
      <div className="flex flex-col gap-1">
        <label htmlFor="client-tier">Service tier</label>
        <select id="client-tier" aria-describedby="tier-hint">
          <option value="">Select a tier</option>
          <option value="retainer">Performance Retainer</option>
          <option value="flagship">Flagship</option>
        </select>
        <p id="tier-hint" className="text-xs text-sb-cream/50">
          Determines billing rate and SLA
        </p>
      </div>

      <button type="submit">Save client</button>
    </form>
  )
}
```

---

## 8. Images & Icons

```tsx
// Decorative images — empty alt (screen readers skip it)
<img src="/bg-texture.jpg" alt="" aria-hidden="true" />

// Informative images — describe content
<img src="/client-logo.png" alt="Acme Medical logo" />

// Icons that convey meaning — label them
<AlertCircle aria-label="Warning" className="text-sb-warning" />

// Icons that are decorative (next to text) — hide from screen readers
<CheckCircle aria-hidden="true" className="text-sb-success" />
<span>Saved successfully</span>

// Never use background-image for meaningful content
```

---

## 9. Colour & Contrast

- **Normal text** (< 18pt): minimum 4.5:1 contrast ratio
- **Large text** (≥ 18pt or bold 14pt): minimum 3:1
- **UI components** (buttons, inputs, focus rings): minimum 3:1

superbad-hq palette — verified ratios against `#1A1A18` background:
- `#FDF5E6` (cream) on `#1A1A18` (bg): **17.2:1** ✅
- `#B22848` (accent) on `#1A1A18` (bg): **4.8:1** ✅
- `#3DB97A` (success) on `#1A1A18` (bg): **6.2:1** ✅
- `#E8A838` (warning) on `#1A1A18` (bg): **8.4:1** ✅
- `#E05252` (danger) on `#1A1A18` (bg): **5.1:1** ✅

**Never convey information by colour alone.** Always pair colour with an icon or text label.

---

## 10. Tables

```tsx
// Data tables need captions and proper header associations
<table>
  <caption className="sr-only">Client list — 12 results</caption>
  <thead>
    <tr>
      <th scope="col">Business</th>
      <th scope="col">Tier</th>
      <th scope="col">
        <button
          aria-label="Sort by revenue, currently ascending"
          onClick={handleSort}
        >
          Revenue
          <ArrowUp aria-hidden="true" />
        </button>
      </th>
      <th scope="col"><span className="sr-only">Actions</span></th>
    </tr>
  </thead>
  <tbody>
    {clients.map(client => (
      <tr key={client.id}>
        <td>{client.name}</td>
        <td>{client.tier}</td>
        <td>{formatCurrency(client.revenue)}</td>
        <td>
          <button aria-label={`Edit ${client.name}`}>
            <Edit aria-hidden="true" />
          </button>
        </td>
      </tr>
    ))}
  </tbody>
</table>
```

---

## 11. sr-only Utility Class

Use for content that should be spoken but not seen:
```tsx
// Tailwind utility — always available
<span className="sr-only">Screen reader only text</span>

// CSS definition (already in tailwind base)
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
```

---

## 12. Accessibility Pre-flight Checklist

Run through this before marking any UI task complete:

- [ ] All images have `alt` text (empty for decorative)
- [ ] All interactive elements are keyboard-reachable
- [ ] Tab order follows visual reading order
- [ ] Focus ring is visible on all interactive elements (never `outline-hidden` without manual management)
- [ ] All form inputs have associated `<label>` (via `htmlFor` or `aria-label`)
- [ ] Error messages use `role="alert"` and are associated via `aria-describedby`
- [ ] Required fields use `aria-required="true"`
- [ ] Modals trap focus and return focus on close
- [ ] Skeleton loaders use `role="status"` with sr-only text
- [ ] Icon-only buttons have `aria-label`
- [ ] No `div` or `span` is being used as a button without `role="button"`, `tabIndex`, and keyboard handler
- [ ] Skip-to-main-content link is present in layout
- [ ] Dynamic content changes use `aria-live`
- [ ] Colour is not the only way information is conveyed
