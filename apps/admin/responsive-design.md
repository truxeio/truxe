# Responsive Design Guide - Truxe Admin Dashboard

A comprehensive guide to responsive design implementation for the Truxe admin dashboard.

## 📱 Breakpoints

### Mobile-First Approach
The admin dashboard uses a mobile-first responsive design approach, starting with mobile devices and progressively enhancing for larger screens.

```css
/* Mobile First Breakpoints */
xs: 320px   /* Mobile Small */
sm: 640px   /* Mobile Large */
md: 768px   /* Tablet */
lg: 1024px  /* Desktop */
xl: 1280px  /* Large Desktop */
2xl: 1536px /* Extra Large */
```

### Breakpoint Usage
```tsx
// Using Tailwind CSS classes
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
  {/* Responsive grid */}
</div>

// Using responsive utilities
import { responsiveClasses } from '@truxe/ui/lib/responsive-utils';

<div className={responsiveClasses.grid3}>
  {/* Responsive grid */}
</div>
```

## 🎨 Layout Patterns

### 1. Container Layout
```tsx
// Responsive container
<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
  {/* Content */}
</div>

// Using utility
<div className={responsiveClasses.container}>
  {/* Content */}
</div>
```

### 2. Grid Layouts
```tsx
// Responsive grid
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
  {/* Grid items */}
</div>

// Using utility
<div className={`${responsiveClasses.grid3} ${responsiveGap.md}`}>
  {/* Grid items */}
</div>
```

### 3. Flexbox Layouts
```tsx
// Responsive flexbox
<div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
  {/* Flex items */}
</div>
```

## 📱 Mobile Optimizations

### Touch-Friendly Design
- **Minimum touch target**: 44px × 44px
- **Touch spacing**: Adequate spacing between interactive elements
- **Swipe gestures**: Support for touch navigation

```tsx
// Touch-friendly button
<button className="min-h-[44px] min-w-[44px] px-4 py-2">
  Touch Button
</button>

// Using utility
<button className={touchFriendly.button}>
  Touch Button
</button>
```

### Mobile Navigation
```tsx
// Collapsible sidebar
<div className="fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0">
  {/* Sidebar content */}
</div>

// Using utility
<div className={responsiveClasses.sidebarMobile}>
  {/* Sidebar content */}
</div>
```

### Mobile Data Tables
```tsx
// Responsive table
<div className="overflow-x-auto">
  <table className="min-w-full divide-y divide-gray-200">
    {/* Table content */}
  </table>
</div>

// Using utility
<div className={responsiveClasses.tableResponsive}>
  <table className="min-w-full divide-y divide-gray-200">
    {/* Table content */}
  </table>
</div>
```

## 📊 Tablet Optimizations

### Two-Column Layouts
```tsx
// Tablet-optimized layout
<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
  <div className="space-y-4">
    {/* Left column */}
  </div>
  <div className="space-y-4">
    {/* Right column */}
  </div>
</div>
```

### Sidebar Navigation
```tsx
// Tablet sidebar
<div className="hidden md:flex md:flex-shrink-0">
  {/* Sidebar content */}
</div>
```

## 🖥️ Desktop Optimizations

### Multi-Column Layouts
```tsx
// Desktop grid
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
  {/* Grid items */}
</div>
```

### Full Sidebar
```tsx
// Desktop sidebar
<div className="hidden lg:flex lg:flex-shrink-0">
  {/* Full sidebar */}
</div>
```

## 🎯 Responsive Typography

### Heading Scale
```tsx
// Responsive headings
<h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold">
  Main Heading
</h1>

<h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold">
  Section Heading
</h2>

// Using utility
<h1 className={responsiveTypography.heading1}>
  Main Heading
</h1>
```

### Body Text
```tsx
// Responsive body text
<p className="text-sm sm:text-base">
  Body text content
</p>

// Using utility
<p className={responsiveTypography.body}>
  Body text content
</p>
```

## 📏 Responsive Spacing

### Spacing Scale
```tsx
// Responsive spacing
<div className="space-y-4 sm:space-y-6 lg:space-y-8">
  {/* Spaced content */}
</div>

// Using utility
<div className={responsiveSpacing.lg}>
  {/* Spaced content */}
</div>
```

### Padding and Margins
```tsx
// Responsive padding
<div className="p-4 sm:p-6 lg:p-8">
  {/* Padded content */}
</div>

// Using utility
<div className={responsivePadding.lg}>
  {/* Padded content */}
</div>
```

## 👁️ Responsive Visibility

### Show/Hide Elements
```tsx
// Show on mobile only
<div className="block sm:hidden">
  Mobile-only content
</div>

// Show on desktop only
<div className="hidden lg:block">
  Desktop-only content
</div>

// Using utility
<div className={responsiveVisibility.showXs}>
  Mobile-only content
</div>
```

### Progressive Enhancement
```tsx
// Progressive enhancement
<div className="flex flex-col sm:flex-row">
  <div className="w-full sm:w-1/2">
    {/* Content */}
  </div>
  <div className="w-full sm:w-1/2">
    {/* Content */}
  </div>
</div>
```

## 🎨 Responsive Components

### Cards
```tsx
// Responsive card
<div className="bg-white rounded-lg shadow p-4 sm:p-6">
  <h3 className="text-lg sm:text-xl font-semibold mb-2">
    Card Title
  </h3>
  <p className="text-sm sm:text-base text-gray-600">
    Card content
  </p>
</div>
```

### Buttons
```tsx
// Responsive button
<button className="px-4 py-2 text-sm sm:text-base font-medium rounded-md">
  Button Text
</button>
```

### Forms
```tsx
// Responsive form
<form className="space-y-4 sm:space-y-6">
  <div>
    <label className="block text-sm font-medium text-gray-700">
      Label
    </label>
    <input className="mt-1 block w-full h-10 px-4 text-sm sm:text-base border border-gray-300 rounded-md" />
  </div>
</form>
```

## 📊 Data Tables

### Responsive Table
```tsx
// Responsive data table
<div className="overflow-x-auto">
  <table className="min-w-full divide-y divide-gray-200">
    <thead className="bg-gray-50">
      <tr>
        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sm:px-6 sm:py-3">
          Name
        </th>
        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sm:px-6 sm:py-3">
          Email
        </th>
      </tr>
    </thead>
    <tbody className="bg-white divide-y divide-gray-200">
      {/* Table rows */}
    </tbody>
  </table>
</div>
```

### Mobile Table Cards
```tsx
// Mobile table as cards
<div className="block sm:hidden">
  {data.map((item) => (
    <div key={item.id} className="bg-white rounded-lg shadow p-4 mb-4">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-sm font-medium text-gray-900">{item.name}</h3>
          <p className="text-sm text-gray-500">{item.email}</p>
        </div>
        <button className="text-sm text-blue-600">Edit</button>
      </div>
    </div>
  ))}
</div>
```

## 🎭 Responsive Modals

### Modal Sizes
```tsx
// Responsive modal
<div className="max-w-sm mx-4 sm:max-w-md md:max-w-lg lg:max-w-2xl">
  {/* Modal content */}
</div>

// Using utility
<div className={`${responsiveClasses.modalMobile} sm:${responsiveClasses.modalTablet} md:${responsiveClasses.modalDesktop}`}>
  {/* Modal content */}
</div>
```

## 🎨 Responsive Images

### Image Sizing
```tsx
// Responsive image
<img
  src="/image.jpg"
  alt="Description"
  className="w-full h-auto max-w-sm sm:max-w-md lg:max-w-lg"
/>

// Responsive background image
<div className="bg-cover bg-center h-32 sm:h-48 lg:h-64" style={{backgroundImage: 'url(/image.jpg)'}}>
  {/* Content */}
</div>
```

## 🔧 Responsive Utilities

### Using Responsive Utilities
```tsx
import { 
  responsiveClasses, 
  responsiveTypography, 
  responsiveSpacing,
  touchFriendly 
} from '@truxe/ui/lib/responsive-utils';

// Container
<div className={responsiveClasses.container}>
  {/* Content */}
</div>

// Typography
<h1 className={responsiveTypography.heading1}>
  Title
</h1>

// Spacing
<div className={responsiveSpacing.lg}>
  {/* Spaced content */}
</div>

// Touch-friendly
<button className={touchFriendly.button}>
  Touch Button
</button>
```

## 🧪 Testing Responsive Design

### Browser Testing
- **Chrome DevTools**: Device emulation
- **Firefox Responsive Design Mode**: Multiple device testing
- **Safari Web Inspector**: iOS device simulation

### Testing Tools
```bash
# Run responsive tests
npm run test:responsive

# Run accessibility tests
npm run accessibility-test

# Run visual regression tests
npm run test:visual
```

### Manual Testing Checklist
- [ ] Mobile (320px - 767px)
  - [ ] Touch targets are 44px minimum
  - [ ] Text is readable without zooming
  - [ ] Navigation is accessible
  - [ ] Forms are usable
- [ ] Tablet (768px - 1023px)
  - [ ] Two-column layouts work
  - [ ] Sidebar navigation is accessible
  - [ ] Content is well-spaced
- [ ] Desktop (1024px+)
  - [ ] Multi-column layouts work
  - [ ] Full sidebar is visible
  - [ ] All features are accessible

## 🎯 Best Practices

### 1. Mobile-First Approach
- Start with mobile design
- Progressively enhance for larger screens
- Use min-width media queries

### 2. Touch-Friendly Design
- Minimum 44px touch targets
- Adequate spacing between elements
- Support for touch gestures

### 3. Performance
- Optimize images for different screen sizes
- Use appropriate image formats
- Minimize layout shifts

### 4. Accessibility
- Maintain accessibility across all breakpoints
- Ensure keyboard navigation works
- Test with screen readers

### 5. Content Strategy
- Prioritize content for mobile
- Use progressive disclosure
- Consider context of use

## 🚀 Implementation Examples

### Complete Responsive Component
```tsx
import React from 'react';
import { responsiveClasses, responsiveTypography, touchFriendly } from '@truxe/ui/lib/responsive-utils';

export function ResponsiveCard({ title, content, actions }) {
  return (
    <div className={`${responsiveClasses.cardPadding} bg-white rounded-lg shadow`}>
      <h3 className={`${responsiveTypography.heading4} mb-2`}>
        {title}
      </h3>
      <p className={`${responsiveTypography.body} text-gray-600 mb-4`}>
        {content}
      </p>
      <div className={`flex flex-col sm:flex-row gap-2 sm:gap-4`}>
        {actions.map((action, index) => (
          <button
            key={index}
            className={`${touchFriendly.button} px-4 py-2 text-sm sm:text-base font-medium rounded-md`}
            onClick={action.onClick}
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}
```

### Responsive Layout
```tsx
import React from 'react';
import { responsiveClasses } from '@truxe/ui/lib/responsive-utils';

export function ResponsiveLayout({ children }) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar */}
      <div className={`${responsiveClasses.sidebarMobile} bg-white shadow-lg`}>
        {/* Sidebar content */}
      </div>
      
      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <div className={`${responsiveClasses.topBarMobile} bg-white shadow-sm border-b border-gray-200`}>
          {/* Top bar content */}
        </div>
        
        {/* Page content */}
        <main className="flex-1">
          <div className={`${responsiveClasses.container} py-6`}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
```

## 📚 Resources

### Documentation
- [Tailwind CSS Responsive Design](https://tailwindcss.com/docs/responsive-design)
- [MDN Responsive Design](https://developer.mozilla.org/en-US/docs/Learn/CSS/CSS_layout/Responsive_Design)
- [Web.dev Responsive Design](https://web.dev/responsive-web-design-basics/)

### Tools
- [Chrome DevTools](https://developers.google.com/web/tools/chrome-devtools)
- [Responsive Design Checker](https://www.responsivedesignchecker.com/)
- [BrowserStack](https://www.browserstack.com/)

### Testing
- [Lighthouse](https://developers.google.com/web/tools/lighthouse)
- [WebPageTest](https://www.webpagetest.org/)
- [GTmetrix](https://gtmetrix.com/)

---

This responsive design guide ensures that the Truxe admin dashboard provides an optimal experience across all devices and screen sizes.

