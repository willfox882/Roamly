# Email fixtures for parser tests

Sonnet must add at least:

- `flight_air_canada.txt` — realistic Air Canada confirmation. Must include flight number `AC123`, PNR `ABC123`, dates with timezone, both airports as IATA codes (e.g., YVR, NRT), passenger name.
- `hotel_marriott.txt` — Marriott confirmation with check-in / check-out dates, address, confirmation number.
- `airbnb_reservation.txt` — Airbnb-style reservation email with property name, host, dates.
- `combined_flight_hotel.txt` — composite email with both a flight and a hotel section.
- `garbage.txt` — random non-travel text that should yield an empty result with no throws.

Strip any real PII before committing. Use synthetic names/emails (e.g., `passenger: Alex Test`, `email: alex@example.com`).
