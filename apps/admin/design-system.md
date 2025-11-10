# Truxe Admin Dashboard Design System

A comprehensive design system for building consistent, accessible, and beautiful admin interfaces.

## 🎨 Design Principles

### 1. **Consistency**
- Unified visual language across all components
- Consistent spacing, typography, and color usage
- Predictable interaction patterns

### 2. **Accessibility First**
- WCAG 2.1 AA compliance
- Keyboard navigation support
- Screen reader compatibility
- High contrast support

### 3. **Mobile-First Responsive**
- Optimized for all screen sizes (320px - 1920px+)
- Touch-friendly interactions
- Adaptive layouts

### 4. **Performance**
- Lightweight and fast
- Optimized for <2 second load times
- Efficient rendering

## 🎨 Color Palette

### Primary Colors
The primary color palette is based on blue tones for trust and professionalism.

```css
/* Primary Blue */
--color-primary-50: #eff6ff;
--color-primary-500: #3b82f6;
--color-primary-900: #1e3a8a;
```

### Semantic Colors
Colors that convey meaning and status.

```css
/* Success - Green */
--color-success-500: #22c55e;

/* Warning - Yellow */
--color-warning-500: #f59e0b;

/* Error - Red */
--color-error-500: #ef4444;

/* Info - Blue */
--color-info-500: #0ea5e9;
```

### Neutral Colors
Grayscale palette for text, borders, and backgrounds.

```css
/* Neutral Grays */
--color-neutral-50: #fafafa;
--color-neutral-500: #737373;
--color-neutral-900: #171717;
```

## 📝 Typography

### Font Family
- **Primary**: Inter (sans-serif)
- **Monospace**: JetBrains Mono

### Type Scale
```css
/* Headings */
--text-6xl: 3.75rem;    /* 60px */
--text-5xl: 3rem;       /* 48px */
--text-4xl: 2.25rem;    /* 36px */
--text-3xl: 1.875rem;   /* 30px */
--text-2xl: 1.5rem;     /* 24px */

/* Body Text */
--text-xl: 1.25rem;     /* 20px */
--text-lg: 1.125rem;    /* 18px */
--text-base: 1rem;      /* 16px */
--text-sm: 0.875rem;    /* 14px */
--text-xs: 0.75rem;     /* 12px */
```

### Font Weights
- **Thin**: 100
- **Light**: 300
- **Normal**: 400
- **Medium**: 500
- **Semibold**: 600
- **Bold**: 700
- **Extrabold**: 800

## 📏 Spacing

### Spacing Scale
Based on a 4px grid system for consistent spacing.

```css
/* Spacing Scale */
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px */
--space-6: 1.5rem;    /* 24px */
--space-8: 2rem;      /* 32px */
--space-12: 3rem;     /* 48px */
--space-16: 4rem;     /* 64px */
--space-24: 6rem;     /* 96px */
```

## 🎭 Shadows

### Shadow Scale
```css
/* Shadow Scale */
--shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
--shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
--shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1);
--shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1);
```

## 🔲 Border Radius

### Radius Scale
```css
/* Border Radius */
--radius-sm: 0.125rem;   /* 2px */
--radius-md: 0.375rem;   /* 6px */
--radius-lg: 0.5rem;     /* 8px */
--radius-xl: 0.75rem;    /* 12px */
--radius-2xl: 1rem;      /* 16px */
--radius-full: 9999px;   /* Fully rounded */
```

## 📱 Breakpoints

### Responsive Breakpoints
```css
/* Breakpoints */
--breakpoint-xs: 320px;   /* Mobile Small */
--breakpoint-sm: 640px;   /* Mobile Large */
--breakpoint-md: 768px;   /* Tablet */
--breakpoint-lg: 1024px;  /* Desktop */
--breakpoint-xl: 1280px;  /* Large Desktop */
--breakpoint-2xl: 1536px; /* Extra Large */
```

## 🎬 Animations

### Animation Durations
```css
/* Animation Durations */
--duration-75: 75ms;
--duration-100: 100ms;
--duration-150: 150ms;
--duration-200: 200ms;
--duration-300: 300ms;
--duration-500: 500ms;
```

### Animation Easing
```css
/* Animation Easing */
--ease-linear: linear;
--ease-in: cubic-bezier(0.4, 0, 1, 1);
--ease-out: cubic-bezier(0, 0, 0.2, 1);
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
```

## 🧩 Component Sizes

### Button Sizes
```css
/* Button Sizes */
--btn-xs: 1.5rem;    /* 24px height */
--btn-sm: 2rem;      /* 32px height */
--btn-md: 2.5rem;    /* 40px height */
--btn-lg: 3rem;      /* 48px height */
--btn-xl: 3.5rem;    /* 56px height */
```

### Input Sizes
```css
/* Input Sizes */
--input-xs: 1.5rem;    /* 24px height */
--input-sm: 2rem;      /* 32px height */
--input-md: 2.5rem;    /* 40px height */
--input-lg: 3rem;      /* 48px height */
```

## 🎯 Component Variants

### Button Variants
- **Primary**: Solid background with primary color
- **Secondary**: Outlined with primary color border
- **Ghost**: Transparent background with hover effects
- **Danger**: Red color for destructive actions

### Badge Variants
- **Success**: Green for positive states
- **Warning**: Yellow for caution states
- **Error**: Red for error states
- **Info**: Blue for informational states
- **Neutral**: Gray for neutral states

### Card Variants
- **Default**: Standard card with subtle shadow
- **Elevated**: More prominent shadow
- **Outlined**: Border-only variant
- **Filled**: Background color variant

## ♿ Accessibility Guidelines

### Color Contrast
- **Normal Text**: Minimum 4.5:1 contrast ratio
- **Large Text**: Minimum 3:1 contrast ratio
- **UI Components**: Minimum 3:1 contrast ratio

### Focus States
- All interactive elements have visible focus indicators
- Focus rings use primary color with 2px outline
- Focus order follows logical tab sequence

### Keyboard Navigation
- All interactive elements are keyboard accessible
- Tab order follows visual layout
- Escape key closes modals and dropdowns
- Arrow keys navigate within components

### Screen Reader Support
- All images have alt text
- Form inputs have associated labels
- Status messages are announced
- Landmark roles for navigation

## 📱 Responsive Design

### Mobile (320px - 767px)
- Single column layout
- Touch-friendly button sizes (44px minimum)
- Collapsible navigation
- Optimized typography scale

### Tablet (768px - 1023px)
- Two-column layout where appropriate
- Sidebar navigation
- Medium button sizes
- Balanced typography

### Desktop (1024px+)
- Multi-column layouts
- Full sidebar navigation
- All component sizes available
- Optimal typography scale

## 🎨 Dark Mode

### Dark Mode Colors
```css
/* Dark Mode Palette */
--color-dark-bg: #0f172a;
--color-dark-surface: #1e293b;
--color-dark-text: #f8fafc;
--color-dark-text-secondary: #cbd5e1;
```

### Dark Mode Implementation
- Automatic detection of system preference
- Manual toggle option
- Smooth transitions between modes
- High contrast support

## 🛠️ Usage Examples

### CSS Custom Properties
```css
.my-component {
  background-color: var(--color-primary-500);
  color: var(--color-neutral-50);
  padding: var(--space-4);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
}
```

### Tailwind Classes
```html
<div class="bg-primary-500 text-neutral-50 p-4 rounded-lg shadow-md">
  Content
</div>
```

### React Components
```tsx
import { Button, Card, Badge } from '@truxe/ui';

<Card className="p-6">
  <h2 className="text-2xl font-bold mb-4">Title</h2>
  <p className="text-neutral-600 mb-4">Description</p>
  <div className="flex gap-2">
    <Button variant="primary">Primary</Button>
    <Button variant="secondary">Secondary</Button>
  </div>
  <Badge variant="success">Success</Badge>
</Card>
```

## 🔧 Customization

### Theme Override
```tsx
import { ThemeProvider } from '@truxe/ui';

const customTheme = {
  colors: {
    primary: {
      500: '#your-primary-color',
    },
  },
};

<ThemeProvider theme={customTheme}>
  <App />
</ThemeProvider>
```

### CSS Variables Override
```css
:root {
  --color-primary-500: #your-color;
  --space-4: 1.5rem;
  --radius-lg: 0.75rem;
}
```

## 📚 Resources

### Design Tools
- [Figma Kit](https://figma.com/truxe-design-system)
- [Storybook](http://localhost:6006)
- [Component Gallery](https://truxe.io/components)

### Documentation
- [Component API Reference](./src/components/admin/README.md)
- [Accessibility Guide](./docs/accessibility.md)
- [Migration Guide](./docs/migration.md)

### Support
- [GitHub Issues](https://github.com/truxe-auth/truxe/issues)
- [Discord Community](https://discord.gg/truxe)
- [Email Support](mailto:support@truxe.io)

---

This design system is continuously evolving. For the latest updates and changes, please refer to the [changelog](./CHANGELOG.md).

