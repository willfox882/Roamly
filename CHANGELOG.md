# Changelog

All notable changes to Roamly will be documented in this file.

## [Unreleased]

### Fixed
- **Timeline Time Conversion (P0)**: Mandated zero timezone conversion for all itinerary times. The app now preserves and displays the exact wall-clock time entered by the user, regardless of local or destination timezones.
- **Trip Detail Date Shifts**: Fixed a bug where trip header dates could shift by one day due to UTC/local conversion.
- **Warning Banner UX (P0)**: Added an "Edit" button to all itinerary warning banners (gaps), allowing users to jump directly to the relevant section (e.g., Hotels or Flights) in the edit form to fix missing data.

### Added
- **Persistent Warning Ignore (P0)**: Users can now permanently ignore specific itinerary warnings (e.g., missing accommodation or confirmation numbers). These preferences are stored in trip metadata and persist across sessions. An "Ignored warnings" section allows users to undo these actions.
- **Flash-free Theme Persistence (P0)**: Theme preference (light/dark) is now persisted in a dedicated `roamly:theme` key and applied via an inline script in the document head, eliminating the initial "theme flash" on load.
