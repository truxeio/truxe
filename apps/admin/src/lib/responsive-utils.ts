/**
 * Responsive Utilities for Truxe Admin Dashboard
 * 
 * This file contains utilities for responsive design including
 * breakpoint detection, responsive classes, and mobile optimizations.
 */

// Breakpoint definitions
export const breakpoints = {
  xs: '320px',
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const;

// Breakpoint values for JavaScript
export const breakpointValues = {
  xs: 320,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

// Device type detection
export type DeviceType = 'mobile' | 'tablet' | 'desktop' | 'large-desktop';

export function getDeviceType(width: number): DeviceType {
  if (width < breakpointValues.md) return 'mobile';
  if (width < breakpointValues.lg) return 'tablet';
  if (width < breakpointValues.xl) return 'desktop';
  return 'large-desktop';
}

// Responsive class utilities
export const responsiveClasses = {
  // Layout
  container: 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8',
  containerSm: 'max-w-3xl mx-auto px-4 sm:px-6',
  containerLg: 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8',
  
  // Grid
  grid1: 'grid grid-cols-1',
  grid2: 'grid grid-cols-1 md:grid-cols-2',
  grid3: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
  grid4: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
  
  // Spacing
  padding: 'p-4 sm:p-6 lg:p-8',
  paddingX: 'px-4 sm:px-6 lg:px-8',
  paddingY: 'py-4 sm:py-6 lg:py-8',
  margin: 'm-4 sm:m-6 lg:m-8',
  marginX: 'mx-4 sm:mx-6 lg:mx-8',
  marginY: 'my-4 sm:my-6 lg:my-8',
  
  // Text
  textXs: 'text-xs sm:text-sm',
  textSm: 'text-sm sm:text-base',
  textBase: 'text-base sm:text-lg',
  textLg: 'text-lg sm:text-xl',
  textXl: 'text-xl sm:text-2xl',
  text2xl: 'text-2xl sm:text-3xl',
  text3xl: 'text-3xl sm:text-4xl',
  
  // Buttons
  buttonSm: 'px-3 py-1.5 text-sm',
  buttonMd: 'px-4 py-2 text-sm sm:text-base',
  buttonLg: 'px-6 py-3 text-base sm:text-lg',
  
  // Forms
  inputSm: 'h-8 px-3 text-sm',
  inputMd: 'h-10 px-4 text-sm sm:text-base',
  inputLg: 'h-12 px-6 text-base sm:text-lg',
  
  // Cards
  cardPadding: 'p-4 sm:p-6',
  cardSpacing: 'space-y-4 sm:space-y-6',
  
  // Tables
  tableResponsive: 'overflow-x-auto',
  tableCell: 'px-3 py-2 text-sm sm:px-6 sm:py-4 sm:text-base',
  
  // Navigation
  sidebarMobile: 'fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0',
  sidebarDesktop: 'hidden lg:flex lg:flex-shrink-0',
  topBarMobile: 'flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8',
  
  // Modals
  modalMobile: 'max-w-sm mx-4',
  modalTablet: 'max-w-md mx-4',
  modalDesktop: 'max-w-lg mx-4',
  modalLarge: 'max-w-2xl mx-4',
} as const;

// Mobile-first responsive utilities
export const mobileFirst = {
  // Show/hide utilities
  show: {
    mobile: 'block sm:hidden',
    tablet: 'hidden sm:block md:hidden',
    desktop: 'hidden md:block lg:hidden',
    largeDesktop: 'hidden lg:block',
  },
  hide: {
    mobile: 'hidden sm:block',
    tablet: 'block sm:hidden md:block',
    desktop: 'block md:hidden lg:block',
    largeDesktop: 'block lg:hidden',
  },
  
  // Flex utilities
  flex: {
    mobile: 'flex sm:hidden',
    tablet: 'hidden sm:flex md:hidden',
    desktop: 'hidden md:flex lg:hidden',
    largeDesktop: 'hidden lg:flex',
  },
  
  // Grid utilities
  grid: {
    mobile: 'grid sm:hidden',
    tablet: 'hidden sm:grid md:hidden',
    desktop: 'hidden md:grid lg:hidden',
    largeDesktop: 'hidden lg:grid',
  },
} as const;

// Touch-friendly utilities
export const touchFriendly = {
  // Minimum touch target size (44px)
  button: 'min-h-[44px] min-w-[44px]',
  input: 'min-h-[44px]',
  link: 'min-h-[44px] min-w-[44px] flex items-center justify-center',
  
  // Touch spacing
  spacing: 'space-y-2 sm:space-y-4',
  padding: 'p-2 sm:p-4',
  
  // Touch gestures
  swipeable: 'touch-pan-x',
  scrollable: 'overflow-x-auto touch-pan-x',
} as const;

// Responsive typography
export const responsiveTypography = {
  heading1: 'text-3xl sm:text-4xl lg:text-5xl font-bold',
  heading2: 'text-2xl sm:text-3xl lg:text-4xl font-bold',
  heading3: 'text-xl sm:text-2xl lg:text-3xl font-semibold',
  heading4: 'text-lg sm:text-xl lg:text-2xl font-semibold',
  heading5: 'text-base sm:text-lg lg:text-xl font-medium',
  heading6: 'text-sm sm:text-base lg:text-lg font-medium',
  
  body: 'text-sm sm:text-base',
  bodyLarge: 'text-base sm:text-lg',
  bodySmall: 'text-xs sm:text-sm',
  
  caption: 'text-xs sm:text-sm text-gray-500',
  label: 'text-xs sm:text-sm font-medium',
} as const;

// Responsive spacing scale
export const responsiveSpacing = {
  xs: 'space-y-1 sm:space-y-2',
  sm: 'space-y-2 sm:space-y-3',
  md: 'space-y-3 sm:space-y-4',
  lg: 'space-y-4 sm:space-y-6',
  xl: 'space-y-6 sm:space-y-8',
  '2xl': 'space-y-8 sm:space-y-12',
} as const;

// Responsive gap utilities
export const responsiveGap = {
  xs: 'gap-1 sm:gap-2',
  sm: 'gap-2 sm:gap-3',
  md: 'gap-3 sm:gap-4',
  lg: 'gap-4 sm:gap-6',
  xl: 'gap-6 sm:gap-8',
  '2xl': 'gap-8 sm:gap-12',
} as const;

// Responsive padding utilities
export const responsivePadding = {
  xs: 'p-2 sm:p-3',
  sm: 'p-3 sm:p-4',
  md: 'p-4 sm:p-6',
  lg: 'p-6 sm:p-8',
  xl: 'p-8 sm:p-12',
  '2xl': 'p-12 sm:p-16',
} as const;

// Responsive margin utilities
export const responsiveMargin = {
  xs: 'm-2 sm:m-3',
  sm: 'm-3 sm:m-4',
  md: 'm-4 sm:m-6',
  lg: 'm-6 sm:m-8',
  xl: 'm-8 sm:m-12',
  '2xl': 'm-12 sm:m-16',
} as const;

// Responsive width utilities
export const responsiveWidth = {
  full: 'w-full',
  auto: 'w-auto',
  fit: 'w-fit',
  min: 'w-min',
  max: 'w-max',
  screen: 'w-screen',
  
  // Fractional widths
  '1/2': 'w-1/2',
  '1/3': 'w-1/3',
  '2/3': 'w-2/3',
  '1/4': 'w-1/4',
  '3/4': 'w-3/4',
  
  // Responsive widths
  responsive: 'w-full sm:w-auto',
  mobileFull: 'w-full sm:w-auto',
  tabletFull: 'w-full md:w-auto',
  desktopFull: 'w-full lg:w-auto',
} as const;

// Responsive height utilities
export const responsiveHeight = {
  full: 'h-full',
  auto: 'h-auto',
  fit: 'h-fit',
  min: 'h-min',
  max: 'h-max',
  screen: 'h-screen',
  
  // Fixed heights
  '1/2': 'h-1/2',
  '1/3': 'h-1/3',
  '2/3': 'h-2/3',
  '1/4': 'h-1/4',
  '3/4': 'h-3/4',
  
  // Responsive heights
  responsive: 'h-auto sm:h-full',
  mobileAuto: 'h-auto sm:h-full',
  tabletAuto: 'h-auto md:h-full',
  desktopAuto: 'h-auto lg:h-full',
} as const;

// Responsive visibility utilities
export const responsiveVisibility = {
  // Show on specific breakpoints
  showXs: 'block sm:hidden',
  showSm: 'hidden sm:block md:hidden',
  showMd: 'hidden md:block lg:hidden',
  showLg: 'hidden lg:block xl:hidden',
  showXl: 'hidden xl:block',
  
  // Hide on specific breakpoints
  hideXs: 'hidden sm:block',
  hideSm: 'block sm:hidden md:block',
  hideMd: 'block md:hidden lg:block',
  hideLg: 'block lg:hidden xl:block',
  hideXl: 'block xl:hidden',
  
  // Show from breakpoint up
  showFromSm: 'hidden sm:block',
  showFromMd: 'hidden md:block',
  showFromLg: 'hidden lg:block',
  showFromXl: 'hidden xl:block',
  
  // Hide from breakpoint up
  hideFromSm: 'block sm:hidden',
  hideFromMd: 'block md:hidden',
  hideFromLg: 'block lg:hidden',
  hideFromXl: 'block xl:hidden',
} as const;

// Responsive positioning utilities
export const responsivePosition = {
  // Fixed positioning
  fixed: 'fixed',
  absolute: 'absolute',
  relative: 'relative',
  sticky: 'sticky',
  static: 'static',
  
  // Responsive positioning
  mobileFixed: 'fixed sm:static',
  tabletFixed: 'fixed md:static',
  desktopFixed: 'fixed lg:static',
} as const;

// Responsive z-index utilities
export const responsiveZIndex = {
  auto: 'z-auto',
  '0': 'z-0',
  '10': 'z-10',
  '20': 'z-20',
  '30': 'z-30',
  '40': 'z-40',
  '50': 'z-50',
  
  // Responsive z-index
  mobileHigh: 'z-50 sm:z-10',
  tabletHigh: 'z-50 md:z-10',
  desktopHigh: 'z-50 lg:z-10',
} as const;

// Export all utilities
export const responsiveUtils = {
  breakpoints,
  breakpointValues,
  getDeviceType,
  responsiveClasses,
  mobileFirst,
  touchFriendly,
  responsiveTypography,
  responsiveSpacing,
  responsiveGap,
  responsivePadding,
  responsiveMargin,
  responsiveWidth,
  responsiveHeight,
  responsiveVisibility,
  responsivePosition,
  responsiveZIndex,
} as const;

export default responsiveUtils;

