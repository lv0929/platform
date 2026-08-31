# Responsive Optimization Report

## Goal
Optimize the market terminal homepage for the required viewport widths without horizontal overflow and maintain the Bloomberg-style information density across device classes.

## Supported breakpoints
- 320px
- 375px
- 768px
- 1024px
- 1366px
- 1920px
- 2560px

## Layout strategy
- Mobile: a single-column stack for readability and safe touch spacing
- Tablet: two-column cards for balanced density
- Laptop: three-column dashboard layout
- Desktop: four-column layout
- Ultra-wide: five and six columns depending on width, preserving dense market coverage without clipping

## CSS Grid usage
The homepage uses CSS Grid for:
- hero layout
- chart grid
- terminal card grid

## Overflow prevention
- `overflow-x: hidden` on the root document and body
- `minmax(0, 1fr)` grid sizing to prevent column overflow
- width-limited containers with flexible, full-width layouts
- `ResizeObserver` updates chart columns in response to viewport changes

## Notes
The design avoids hardcoded terminal data and instead reads from the backend. This keeps the layout responsive while remaining data-driven and easy to maintain.
