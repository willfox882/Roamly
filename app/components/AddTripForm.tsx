'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { X, Plus, Trash2, ChevronDown, ChevronUp, Plane, Bed, Calendar, Sparkles, Loader2, WifiOff, AlertTriangle, Bus, CalendarCheck, ShieldAlert, Pencil } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useRouter, useSearchParams } from 'next/navigation';
import { clsx } from 'clsx';
import { useOffline } from '@/hooks/useOffline';
import { getProviderInfo } from '@/lib/aiClient';
import type { ParsedEvent, Event as TripEvent } from '@/lib/schema';
import iataTable from '@/lib/data/iata.json';
import BucketAutoUpdateControl from './BucketAutoUpdateControl';

interface Destination {
  name: string;
  lat: number;
  lng: number;
  placeId?: string;
  admin1?: string;
  country?: string;
}

interface AddTripFormProps {
  onClose: () => void;
  onSave: (
    events: ParsedEvent[], 
    tripId: string | null, 
    options: { manualTitle?: string, primaryDestination?: Destination | null, autoAddToBucket?: boolean, meta?: any }
  ) => Promise<void>;
  onParse: (rawText: string) => Promise<ParsedEvent[]>;
  initialTripId?: string | null;
  initialEvents?: TripEvent[];
  initialTitle?: string;
  initialDestination?: Destination | null;
  initialAutoAdd?: boolean;
  initialMeta?: any;
  aiConsent?: boolean;
  onShowConsent?: () => void;
}

interface FlightLeg {
  id: string;
  from: string;
  to: string;
  departureDate: string;
  departureTime: string;
  arrivalDate: string;
  arrivalTime: string;
  flightNumber: string;
  confirmationNumber: string;
}

interface Accommodation {
  id: string;
  name: string;
  address: string;
  checkInDate: string;
  checkInTime: string;
  checkOutDate: string;
  checkOutTime: string;
  confirmationNumber: string;
}

interface Excursion {
  id: string;
  title: string;
  date: string;
  time: string;
  notes: string;
}

interface Transportation {
  id: string;
  type: 'taxi' | 'shuttle' | 'train' | 'bus' | 'other';
  provider: string;
  confirmationNumber: string;
  date: string;
  time: string;
}

interface Reservation {
  id: string;
  title: string;
  provider: string;
  confirmationNumber: string;
  date: string;
  time: string;
}

interface SearchableInputProps {
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
  className?: string;
}

function SearchableInput({ value, onChange, placeholder, className }: SearchableInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);

  const suggestions = useMemo(() => {
    if (!query.trim() || query.length < 2) return [];
    if (/^[A-Z]{3} - /.test(query)) return [];

    const q = query.toUpperCase();
    return Object.entries(iataTable as Record<string, any>)
      .filter(([code, info]) => 
        code.includes(q) || 
        info.city?.toUpperCase().includes(q) || 
        info.name?.toUpperCase().includes(q)
      )
      .slice(0, 5)
      .map(([code, info]) => ({ code, ...info }));
  }, [query]);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full text-black">
      <input
        placeholder={placeholder}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          onChange(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        className={clsx("roamly-input w-full px-3 py-2 text-sm focus:border-primary focus:outline-none", className)}
      />
      {isOpen && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-y-auto rounded-lg border border-subtle bg-white shadow-xl">
          {suggestions.map((s) => (
            <button
              key={s.code}
              type="button"
              onClick={() => {
                const display = `${s.code} - ${s.city || s.name}`;
                setQuery(display);
                onChange(display);
                setIsOpen(false);
              }}
              className="w-full px-3 py-2 text-left text-sm hover:bg-black/[0.04] transition-colors flex flex-col"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-primary">{s.code}</span>
                <span className="text-[10px] text-muted uppercase">{s.country}</span>
              </div>
              <span className="text-muted truncate text-xs">
                {s.city ? `${s.city}` : s.name}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AddTripForm({ 
  onClose, 
  onSave, 
  onParse, 
  initialTripId, 
  initialEvents, 
  initialTitle, 
  initialDestination,
  initialAutoAdd = true,
  initialMeta,
  aiConsent, 
  onShowConsent 
}: AddTripFormProps) {
  const { online } = useOffline();
  const searchParams = useSearchParams();
  const focusTarget = searchParams.get('focus');
  const providerInfo = useMemo(() => getProviderInfo(), []);
  const [activeSection, setActiveSection] = useState<'manual' | 'paste'>('manual');
  const [isSaving, setIsSaving] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [rawText, setRawText] = useState('');
  const [tripTitle, setTripTitle] = useState(initialTitle || '');
  const [destination, setDestination] = useState<Destination | null>(initialDestination || null);
  const [autoAdd, setAutoAdd] = useState(initialAutoAdd);
  const [useFlightAsTransport, setUseFlightAsTransport] = useState(false);
  
  const hasInitialized = useRef(false);
  const flightsRef = useRef<HTMLDivElement>(null);
  const accommodationRef = useRef<HTMLDivElement>(null);
  const transportationRef = useRef<HTMLDivElement>(null);
  const excursionsRef = useRef<HTMLDivElement>(null);
  const reservationsRef = useRef<HTMLDivElement>(null);

  // Manual Form State
  const [flightLegs, setFlightLegs] = useState<FlightLeg[]>([
    { id: uuidv4(), from: '', to: '', departureDate: '', departureTime: '', arrivalDate: '', arrivalTime: '', flightNumber: '', confirmationNumber: '' }
  ]);
  const [accommodations, setAccommodations] = useState<Accommodation[]>([
    { id: uuidv4(), name: '', address: '', checkInDate: '', checkInTime: '', checkOutDate: '', checkOutTime: '', confirmationNumber: '' }
  ]);
  const [excursions, setExcursions] = useState<Excursion[]>([
    { id: uuidv4(), title: '', date: '', time: '', notes: '' }
  ]);
  const [transportations, setTransportations] = useState<Transportation[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);

  // Sync state from props when they load (async Dexie result)
  useEffect(() => {
    if (initialEvents && initialEvents.length > 0 && !hasInitialized.current) {
      const flights = initialEvents.filter(e => e.type === 'flight');
      if (flights.length > 0) {
        setFlightLegs(flights.map(f => {
          const pj = f.parsedJson as any;
          return {
            id: f.id,
            from: pj?.from ?? f.locationName?.split(' to ')[0] ?? '',
            to: pj?.to ?? f.locationName?.split(' to ')[1] ?? '',
            departureDate: f.startDatetime?.slice(0, 10) ?? '',
            departureTime: f.startDatetime?.slice(11, 16) ?? '',
            arrivalDate: f.endDatetime?.slice(0, 10) ?? '',
            arrivalTime: f.endDatetime?.slice(11, 16) ?? '',
            flightNumber: f.provider ?? pj?.flightNumber ?? '',
            confirmationNumber: f.confirmationNumber ?? ''
          };
        }));
      }

      const hotels = initialEvents.filter(e => e.type === 'hotel');
      if (hotels.length > 0) {
        setAccommodations(hotels.map(h => ({
          id: h.id,
          name: h.locationName ?? '',
          address: (h.parsedJson as any)?.address ?? '',
          checkInDate: h.startDatetime?.slice(0, 10) ?? '',
          checkInTime: h.startDatetime?.slice(11, 16) ?? '',
          checkOutDate: h.endDatetime?.slice(0, 10) ?? '',
          checkOutTime: h.endDatetime?.slice(11, 16) ?? '',
          confirmationNumber: h.confirmationNumber ?? ''
        })));
      }

      const excs = initialEvents.filter(e => e.type === 'excursion');
      if (excs.length > 0) {
        setExcursions(excs.map(e => ({
          id: e.id,
          title: e.locationName ?? '',
          date: e.startDatetime?.slice(0, 10) ?? '',
          time: e.startDatetime?.slice(11, 16) ?? '',
          notes: (e.parsedJson as any)?.notes ?? ''
        })));
      }

      const trans = initialEvents.filter(e => e.type === 'transport');
      if (trans.length > 0) {
        setTransportations(trans.map(t => ({
          id: t.id,
          type: (t.parsedJson as any)?.type ?? 'other',
          provider: t.provider ?? '',
          confirmationNumber: t.confirmationNumber ?? '',
          date: t.startDatetime?.slice(0, 10) ?? '',
          time: t.startDatetime?.slice(11, 16) ?? ''
        })));
      }

      const resvs = initialEvents.filter(e => e.type === 'reservation');
      if (resvs.length > 0) {
        setReservations(resvs.map(r => ({
          id: r.id,
          title: r.locationName ?? '',
          provider: r.provider ?? '',
          confirmationNumber: r.confirmationNumber ?? '',
          date: r.startDatetime?.slice(0, 10) ?? '',
          time: r.startDatetime?.slice(11, 16) ?? ''
        })));
      }
      
      if (initialTitle) setTripTitle(initialTitle);
      if (initialDestination) setDestination(initialDestination);
      if (initialAutoAdd !== undefined) setAutoAdd(initialAutoAdd);
      hasInitialized.current = true;
    } else if (initialTitle && !tripTitle && !hasInitialized.current) {
      setTripTitle(initialTitle);
    }
  }, [initialEvents, initialTitle, initialDestination, initialAutoAdd, tripTitle]);

  const [expandedSections, setExpandedSections] = useState({
    flights: true,
    accommodation: true,
    transportation: true,
    excursions: true,
    reservations: true
  });

  // Focus logic
  useEffect(() => {
    if (focusTarget && activeSection === 'manual') {
      const scrollOptions: ScrollIntoViewOptions = { behavior: 'smooth', block: 'start' };
      setTimeout(() => {
        if (focusTarget === 'flights' && flightsRef.current) {
          flightsRef.current.scrollIntoView(scrollOptions);
          setExpandedSections(prev => ({ ...prev, flights: true }));
        } else if (focusTarget === 'accommodation' && accommodationRef.current) {
          accommodationRef.current.scrollIntoView(scrollOptions);
          setExpandedSections(prev => ({ ...prev, accommodation: true }));
        }
      }, 100);
    }
  }, [focusTarget, activeSection]);

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const addFlightLeg = () => {
    setFlightLegs([...flightLegs, { id: uuidv4(), from: '', to: '', departureDate: '', departureTime: '', arrivalDate: '', arrivalTime: '', flightNumber: '', confirmationNumber: '' }]);
  };

  const removeFlightLeg = (id: string) => {
    setFlightLegs(flightLegs.filter(l => l.id !== id));
  };

  const addAccommodation = () => {
    setAccommodations([...accommodations, { id: uuidv4(), name: '', address: '', checkInDate: '', checkInTime: '', checkOutDate: '', checkOutTime: '', confirmationNumber: '' }]);
  };

  const removeAccommodation = (id: string) => {
    setAccommodations(accommodations.filter(a => a.id !== id));
  };

  const addExcursion = () => {
    setExcursions([...excursions, { id: uuidv4(), title: '', date: '', time: '', notes: '' }]);
  };

  const removeExcursion = (id: string) => {
    setExcursions(excursions.filter(e => e.id !== id));
  };

  const addTransportation = () => {
    setTransportations([...transportations, { id: uuidv4(), type: 'other', provider: '', confirmationNumber: '', date: '', time: '' }]);
  };

  const removeTransportation = (id: string) => {
    setTransportations(transportations.filter(t => t.id !== id));
  };

  const addReservation = () => {
    setReservations([...reservations, { id: uuidv4(), title: '', provider: '', confirmationNumber: '', date: '', time: '' }]);
  };

  const removeReservation = (id: string) => {
    setReservations(reservations.filter(r => r.id !== id));
  };

  const handleManualSave = async () => {
    setIsSaving(true);
    const events: ParsedEvent[] = [];

    // Map flights
    flightLegs.forEach(leg => {
      if (leg.from && leg.to && leg.departureDate) {
        const fromCode = leg.from.match(/^([A-Z]{3})\b/)?.[1] || leg.from;
        const toCode   = leg.to.match(/^([A-Z]{3})\b/)?.[1] || leg.to;

        const startStr = `${leg.departureDate}T${leg.departureTime || '00:00'}:00`;
        const endStr   = leg.arrivalDate ? `${leg.arrivalDate}T${leg.arrivalTime || '00:00'}:00` : null;

        events.push({
          type: 'flight',
          startDatetime: `${startStr}Z`,
          endDatetime: endStr ? `${endStr}Z` : null,
          displayStartDatetime: startStr,
          displayEndDatetime: endStr,
          locationName: `${leg.from} to ${leg.to}`,
          provider: leg.flightNumber || null,
          confirmationNumber: leg.confirmationNumber || null,
          pnr: null,
          timezone: 'UTC',
          lat: (iataTable as any)[toCode]?.lat || null,
          lng: (iataTable as any)[toCode]?.lng || null,
          rawSourceJson: {},
          parsedJson: { from: fromCode, to: toCode, flightNumber: leg.flightNumber },
          confidence: 1,
          status: 'confirmed'
        });

        if (useFlightAsTransport) {
          events.push({
            type: 'transport',
            startDatetime: `${leg.departureDate}T${leg.departureTime || '00:00'}:00Z`,
            endDatetime: leg.arrivalDate ? `${leg.arrivalDate}T${leg.arrivalTime || '00:00'}:00Z` : null,
            locationName: `Flight ${leg.flightNumber || ''} (${leg.from} to ${leg.to})`,
            provider: leg.flightNumber || null,
            confirmationNumber: leg.confirmationNumber || null,
            pnr: null,
            timezone: 'UTC',
            lat: (iataTable as any)[toCode]?.lat || null,
            lng: (iataTable as any)[toCode]?.lng || null,
            rawSourceJson: {},
            parsedJson: { type: 'flight' },
            confidence: 1,
            status: 'confirmed'
          });
        }
      }
    });

    // Map accommodations
    accommodations.forEach(acc => {
      if (acc.name && acc.checkInDate) {
        events.push({
          type: 'hotel',
          startDatetime: `${acc.checkInDate}T${acc.checkInTime || '15:00'}:00Z`,
          endDatetime: acc.checkOutDate ? `${acc.checkOutDate}T${acc.checkOutTime || '11:00'}:00Z` : null,
          locationName: acc.name,
          provider: acc.name,
          confirmationNumber: acc.confirmationNumber || null,
          pnr: null,
          timezone: 'UTC',
          lat: null,
          lng: null,
          rawSourceJson: {},
          parsedJson: { address: acc.address },
          confidence: 1,
          status: 'confirmed'
        });
      }
    });

    // Map transportations
    transportations.forEach(t => {
      if (t.type && t.date) {
        events.push({
          type: 'transport',
          startDatetime: `${t.date}T${t.time || '12:00'}:00Z`,
          endDatetime: null,
          locationName: `${t.type.toUpperCase()}${t.provider ? ` - ${t.provider}` : ''}`,
          provider: t.provider || null,
          confirmationNumber: t.confirmationNumber || null,
          pnr: null,
          timezone: 'UTC',
          lat: null,
          lng: null,
          rawSourceJson: {},
          parsedJson: { type: t.type },
          confidence: 1,
          status: 'confirmed'
        });
      }
    });

    // Map excursions
    excursions.forEach(exc => {
      if (exc.title && exc.date) {
        events.push({
          type: 'excursion',
          startDatetime: `${exc.date}T${exc.time || '12:00'}:00Z`,
          endDatetime: null,
          locationName: exc.title,
          provider: null,
          confirmationNumber: null,
          pnr: null,
          timezone: 'UTC',
          lat: null,
          lng: null,
          rawSourceJson: {},
          parsedJson: { notes: exc.notes },
          confidence: 1,
          status: 'confirmed'
        });
      }
    });

    // Map reservations
    reservations.forEach(r => {
      if (r.title && r.date) {
        events.push({
          type: 'reservation',
          startDatetime: `${r.date}T${r.time || '12:00'}:00Z`,
          endDatetime: null,
          locationName: r.title,
          provider: r.provider || null,
          confirmationNumber: r.confirmationNumber || null,
          pnr: null,
          timezone: 'UTC',
          lat: null,
          lng: null,
          rawSourceJson: {},
          parsedJson: {},
          confidence: 1,
          status: 'confirmed'
        });
      }
    });

    if (events.length === 0) {
      setIsSaving(false);
      alert('Please add at least one event with a date.');
      return;
    }

    try {
      await onSave(events, initialTripId ?? null, { 
        manualTitle: tripTitle || undefined,
        primaryDestination: destination,
        autoAddToBucket: autoAdd,
        meta: initialMeta
      });
    } catch (e) {
      console.error(e);
      setIsSaving(false);
    }
  };

  const handlePasteParse = async () => {
    if (!rawText.trim()) return;
    setIsParsing(true);
    try {
      const result = await onParse(rawText);
      const newFlights: FlightLeg[] = [];
      const newAccs: Accommodation[] = [];
      const newExcs: Excursion[] = [];
      const newTrans: Transportation[] = [];
      const newResvs: Reservation[] = [];

      result.forEach(ev => {
        const departureDate = ev.startDatetime?.slice(0, 10) ?? '';
        const departureTime = ev.startDatetime?.slice(11, 16) ?? '';
        const arrivalDate   = ev.endDatetime?.slice(0, 10) ?? '';
        const arrivalTime   = ev.endDatetime?.slice(11, 16) ?? '';

        if (ev.type === 'flight') {
          newFlights.push({
            id: uuidv4(),
            from: (ev.parsedJson as any)?.from ?? '',
            to: (ev.parsedJson as any)?.to ?? '',
            departureDate,
            departureTime,
            arrivalDate,
            arrivalTime,
            flightNumber: ev.provider ?? '',
            confirmationNumber: ev.confirmationNumber ?? ''
          });
        } else if (ev.type === 'hotel') {
          newAccs.push({
            id: uuidv4(),
            name: ev.locationName ?? '',
            address: (ev.parsedJson as any)?.address ?? '',
            checkInDate: departureDate,
            checkInTime: departureTime,
            checkOutDate: arrivalDate,
            checkOutTime: arrivalTime,
            confirmationNumber: ev.confirmationNumber ?? ''
          });
        } else if (ev.type === 'transport') {
          newTrans.push({
            id: uuidv4(),
            type: (ev.parsedJson as any)?.type ?? 'other',
            provider: ev.provider ?? '',
            confirmationNumber: ev.confirmationNumber ?? '',
            date: departureDate,
            time: departureTime
          });
        } else if (ev.type === 'reservation') {
          newResvs.push({
            id: uuidv4(),
            title: ev.locationName ?? '',
            provider: ev.provider ?? '',
            confirmationNumber: ev.confirmationNumber ?? '',
            date: departureDate,
            time: departureTime
          });
        } else {
          newExcs.push({
            id: uuidv4(),
            title: ev.locationName ?? '',
            date: departureDate,
            time: departureTime,
            notes: (ev.parsedJson as any)?.notes ?? ''
          });
        }
      });

      if (newFlights.length > 0) setFlightLegs(newFlights);
      if (newAccs.length > 0) setAccommodations(newAccs);
      if (newExcs.length > 0) setExcursions(newExcs);
      if (newTrans.length > 0) setTransportations(newTrans);
      if (newResvs.length > 0) setReservations(newResvs);
      
      setActiveSection('manual');
    } catch (e) {
      console.error(e);
    } finally {
      setIsParsing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-surface overflow-hidden">
      <div className="glass flex items-center justify-between px-4 py-3 safe-area-top shrink-0">
        <h2 className="text-base font-semibold text-ink">{initialTripId ? 'Edit Trip' : 'Add Trip'}</h2>
        <button onClick={onClose} className="touch-target flex items-center justify-center rounded-lg p-1.5 hover:bg-black/[0.06] dark:hover:bg-white/[0.06]">
          <X size={18} className="text-muted" />
        </button>
      </div>

      <div className="flex border-b border-subtle bg-card shrink-0">
        <button
          onClick={() => setActiveSection('manual')}
          className={clsx(
            "flex-1 py-3 text-sm font-medium transition-colors",
            activeSection === 'manual' ? "text-primary border-b-2 border-primary" : "text-muted hover:text-ink"
          )}
        >
          Manual Entry
        </button>
        <button
          onClick={() => setActiveSection('paste')}
          className={clsx(
            "flex-1 py-3 text-sm font-medium transition-colors",
            activeSection === 'paste' ? "text-primary border-b-2 border-primary" : "text-muted hover:text-ink"
          )}
        >
          Paste Email
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {activeSection === 'manual' ? (
          <div className="space-y-6 pb-20">
            <section className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase text-muted">Trip Name</label>
                <input 
                  placeholder="e.g. Las Vegas Weekend"
                  value={tripTitle}
                  onChange={e => setTripTitle(e.target.value)}
                  className="roamly-input w-full px-4 py-3 text-sm font-semibold focus:border-primary focus:outline-none"
                />
              </div>

              <BucketAutoUpdateControl 
                selectedDestination={destination}
                onDestinationChange={setDestination}
                autoAdd={autoAdd}
                onAutoAddChange={setAutoAdd}
              />
            </section>

            <section ref={flightsRef} className="space-y-3 scroll-mt-20">
              <button 
                type="button"
                onClick={() => toggleSection('flights')}
                className="flex w-full items-center justify-between text-left"
              >
                <div className="flex items-center gap-2 font-semibold text-ink">
                  <Plane size={18} className="text-primary" />
                  <span>Flights</span>
                </div>
                {expandedSections.flights ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>
              
              {expandedSections.flights && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 px-1">
                    <input 
                      type="checkbox" 
                      id="useFlightAsTransport" 
                      checked={useFlightAsTransport}
                      onChange={(e) => setUseFlightAsTransport(e.target.checked)}
                      className="rounded border-subtle text-primary focus:ring-primary h-4 w-4 bg-white"
                    />
                    <label htmlFor="useFlightAsTransport" className="text-xs text-muted cursor-pointer select-none">
                      Use flight arrivals to complete &quot;Transportation&quot; checklist
                    </label>
                  </div>

                  {flightLegs.map((leg) => (
                    <div key={leg.id} className="glass rounded-xl p-4 space-y-3 relative border border-subtle">
                      {flightLegs.length > 1 && (
                        <button 
                          type="button"
                          onClick={() => removeFlightLeg(leg.id)}
                          className="absolute top-2 right-2 text-muted hover:text-danger p-1"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase text-muted">From</label>
                          <SearchableInput 
                            placeholder="SFO / San Francisco"
                            value={leg.from}
                            onChange={val => setFlightLegs(legs => legs.map(l => l.id === leg.id ? {...l, from: val} : l))}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase text-muted">To</label>
                          <SearchableInput 
                            placeholder="LHR / London"
                            value={leg.to}
                            onChange={val => setFlightLegs(legs => legs.map(l => l.id === leg.id ? {...l, to: val} : l))}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase text-muted">Departure</label>
                          <div className="flex gap-1">
                            <input type="date" value={leg.departureDate} onChange={e => setFlightLegs(legs => legs.map(l => l.id === leg.id ? {...l, departureDate: e.target.value} : l))} className="roamly-input roamly-date-input flex-1 px-2 py-2 text-xs focus:border-primary focus:outline-none" />
                            <input type="time" value={leg.departureTime} onChange={e => setFlightLegs(legs => legs.map(l => l.id === leg.id ? {...l, departureTime: e.target.value} : l))} className="roamly-input w-20 px-2 py-2 text-xs focus:border-primary focus:outline-none" />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase text-muted">Arrival (optional)</label>
                          <div className="flex gap-1">
                            <input type="date" value={leg.arrivalDate} onChange={e => setFlightLegs(legs => legs.map(l => l.id === leg.id ? {...l, arrivalDate: e.target.value} : l))} className="roamly-input roamly-date-input flex-1 px-2 py-2 text-xs focus:border-primary focus:outline-none" />
                            <input type="time" value={leg.arrivalTime} onChange={e => setFlightLegs(legs => legs.map(l => l.id === leg.id ? {...l, arrivalTime: e.target.value} : l))} className="roamly-input w-20 px-2 py-2 text-xs focus:border-primary focus:outline-none" />
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <input placeholder="Flight #" value={leg.flightNumber} onChange={e => setFlightLegs(legs => legs.map(l => l.id === leg.id ? {...l, flightNumber: e.target.value} : l))} className="roamly-input px-3 py-2 text-sm focus:border-primary focus:outline-none" />
                        <input placeholder="Confirmation #" value={leg.confirmationNumber} onChange={e => setFlightLegs(legs => legs.map(l => l.id === leg.id ? {...l, confirmationNumber: e.target.value} : l))} className="roamly-input px-3 py-2 text-sm focus:border-primary focus:outline-none" />
                      </div>
                    </div>
                  ))}
                  <button type="button" onClick={addFlightLeg} className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-subtle py-3 text-sm font-medium text-muted hover:border-primary hover:text-primary transition-colors">
                    <Plus size={16} />
                    <span>Add Leg</span>
                  </button>
                </div>
              )}
            </section>

            <section ref={accommodationRef} className="space-y-3 scroll-mt-20">
              <button 
                type="button"
                onClick={() => toggleSection('accommodation')}
                className="flex w-full items-center justify-between text-left"
              >
                <div className="flex items-center gap-2 font-semibold text-ink">
                  <Bed size={18} className="text-primary" />
                  <span>Accommodation</span>
                </div>
                {expandedSections.accommodation ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>
              
              {expandedSections.accommodation && (
                <div className="space-y-4">
                  {accommodations.map((acc) => (
                    <div key={acc.id} className="glass rounded-xl p-4 space-y-3 relative border border-subtle">
                      <button 
                        type="button"
                        onClick={() => removeAccommodation(acc.id)}
                        className="absolute top-2 right-2 text-muted hover:text-danger p-1"
                      >
                        <Trash2 size={16} />
                      </button>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-muted">Hotel / Stay Name</label>
                        <input 
                          placeholder="Ace Hotel London"
                          value={acc.name}
                          onChange={e => setAccommodations(accs => accs.map(a => a.id === acc.id ? {...a, name: e.target.value} : a))}
                          className="roamly-input w-full px-3 py-2 text-sm focus:border-primary focus:outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-muted">Address</label>
                        <input 
                          placeholder="100 Shoreditch High St, London"
                          value={acc.address}
                          onChange={e => setAccommodations(accs => accs.map(a => a.id === acc.id ? {...a, address: e.target.value} : a))}
                          className="roamly-input w-full px-3 py-2 text-sm focus:border-primary focus:outline-none"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase text-muted">Check-in</label>
                          <div className="flex gap-1">
                            <input type="date" value={acc.checkInDate} onChange={e => setAccommodations(accs => accs.map(a => a.id === acc.id ? {...a, checkInDate: e.target.value} : a))} className="roamly-input roamly-date-input flex-1 px-2 py-2 text-xs focus:border-primary focus:outline-none" />
                            <input type="time" value={acc.checkInTime} onChange={e => setAccommodations(accs => accs.map(a => a.id === acc.id ? {...a, checkInTime: e.target.value} : a))} className="roamly-input w-20 px-2 py-2 text-xs focus:border-primary focus:outline-none" />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase text-muted">Check-out</label>
                          <div className="flex gap-1">
                            <input type="date" value={acc.checkOutDate} onChange={e => setAccommodations(accs => accs.map(a => a.id === acc.id ? {...a, checkOutDate: e.target.value} : a))} className="roamly-input roamly-date-input flex-1 px-2 py-2 text-xs focus:border-primary focus:outline-none" />
                            <input type="time" value={acc.checkOutTime} onChange={e => setAccommodations(accs => accs.map(a => a.id === acc.id ? {...a, checkOutTime: e.target.value} : a))} className="roamly-input w-20 px-2 py-2 text-xs focus:border-primary focus:outline-none" />
                          </div>
                        </div>
                      </div>
                      {acc.checkInDate && acc.checkOutDate && (
                         <div className="text-[10px] text-primary font-bold uppercase">
                            {Math.max(0, Math.ceil((new Date(acc.checkOutDate).getTime() - new Date(acc.checkInDate).getTime()) / (1000 * 60 * 60 * 24)))} NIGHTS
                         </div>
                      )}
                    </div>
                  ))}
                  <button type="button" onClick={addAccommodation} className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-subtle py-3 text-sm font-medium text-muted hover:border-primary hover:text-primary transition-colors">
                    <Plus size={16} />
                    <span>Add Accommodation</span>
                  </button>
                </div>
              )}
            </section>

            <section ref={transportationRef} className="space-y-3 scroll-mt-20">
              <button 
                type="button"
                onClick={() => toggleSection('transportation')}
                className="flex w-full items-center justify-between text-left"
              >
                <div className="flex items-center gap-2 font-semibold text-ink">
                  <Bus size={18} className="text-primary" />
                  <span>Transportation</span>
                </div>
                {expandedSections.transportation ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>
              
              {expandedSections.transportation && (
                <div className="space-y-4">
                  {transportations.map((t) => (
                    <div key={t.id} className="glass rounded-xl p-4 space-y-3 relative border border-subtle">
                      <button 
                        type="button"
                        onClick={() => removeTransportation(t.id)}
                        className="absolute top-2 right-2 text-muted hover:text-danger p-1"
                      >
                        <Trash2 size={16} />
                      </button>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase text-muted">Type</label>
                          <select 
                            value={t.type}
                            onChange={e => setTransportations(ts => ts.map(x => x.id === t.id ? {...x, type: e.target.value as any} : x))}
                            className="roamly-input w-full px-3 py-2 text-sm focus:border-primary focus:outline-none"
                          >
                            <option value="taxi">Taxi / Uber</option>
                            <option value="shuttle">Shuttle</option>
                            <option value="train">Train</option>
                            <option value="bus">Bus</option>
                            <option value="other">Other</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase text-muted">Provider</label>
                          <input 
                            placeholder="e.g. Amtrak, Uber"
                            value={t.provider}
                            onChange={e => setTransportations(ts => ts.map(x => x.id === t.id ? {...x, provider: e.target.value} : x))}
                            className="roamly-input w-full px-3 py-2 text-sm focus:border-primary focus:outline-none"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase text-muted">Date & Time</label>
                          <div className="flex gap-1">
                            <input type="date" value={t.date} onChange={e => setTransportations(ts => ts.map(x => x.id === t.id ? {...x, date: e.target.value} : x))} className="roamly-input roamly-date-input flex-1 px-2 py-2 text-xs focus:border-primary focus:outline-none" />
                            <input type="time" value={t.time} onChange={e => setTransportations(ts => ts.map(x => x.id === t.id ? {...x, time: e.target.value} : x))} className="roamly-input w-20 px-2 py-2 text-xs focus:border-primary focus:outline-none" />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase text-muted">Confirmation #</label>
                          <input 
                            placeholder="Optional"
                            value={t.confirmationNumber}
                            onChange={e => setTransportations(ts => ts.map(x => x.id === t.id ? {...x, confirmationNumber: e.target.value} : x))}
                            className="roamly-input w-full px-3 py-2 text-sm focus:border-primary focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  <button type="button" onClick={addTransportation} className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-subtle py-3 text-sm font-medium text-muted hover:border-primary hover:text-primary transition-colors">
                    <Plus size={16} />
                    <span>Add Transportation</span>
                  </button>
                </div>
              )}
            </section>

            <section ref={excursionsRef} className="space-y-3 scroll-mt-20">
              <button 
                type="button"
                onClick={() => toggleSection('excursions')}
                className="flex w-full items-center justify-between text-left"
              >
                <div className="flex items-center gap-2 font-semibold text-ink">
                  <Calendar size={18} className="text-primary" />
                  <span>Excursions</span>
                </div>
                {expandedSections.excursions ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>
              
              {expandedSections.excursions && (
                <div className="space-y-4">
                  {excursions.map((exc) => (
                    <div key={exc.id} className="glass rounded-xl p-4 space-y-3 relative border border-subtle">
                      <button 
                        type="button"
                        onClick={() => removeExcursion(exc.id)}
                        className="absolute top-2 right-2 text-muted hover:text-danger p-1"
                      >
                        <Trash2 size={16} />
                      </button>
                      <input 
                        placeholder="Dinner at Sketch / Museum Visit"
                        value={exc.title}
                        onChange={e => setExcursions(excs => excs.map(ex => ex.id === exc.id ? {...ex, title: e.target.value} : ex))}
                        className="roamly-input w-full px-3 py-2 text-sm font-medium focus:border-primary focus:outline-none"
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <input type="date" value={exc.date} onChange={e => setExcursions(excs => excs.map(ex => ex.id === exc.id ? {...ex, date: e.target.value} : ex))} className="roamly-input roamly-date-input px-3 py-2 text-sm focus:border-primary focus:outline-none" />
                        <input type="time" value={exc.time} onChange={e => setExcursions(excs => excs.map(ex => ex.id === exc.id ? {...ex, time: e.target.value} : ex))} className="roamly-input px-3 py-2 text-sm focus:border-primary focus:outline-none" />
                      </div>
                      <textarea 
                        placeholder="Notes (optional)"
                        rows={2}
                        value={exc.notes}
                        onChange={e => setExcursions(excs => excs.map(ex => ex.id === exc.id ? {...ex, notes: e.target.value} : ex))}
                        className="roamly-input w-full px-3 py-2 text-sm focus:border-primary focus:outline-none resize-none"
                      />
                    </div>
                  ))}
                  <button type="button" onClick={addExcursion} className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-subtle py-3 text-sm font-medium text-muted hover:border-primary hover:text-primary transition-colors">
                    <Plus size={16} />
                    <span>Add Excursion</span>
                  </button>
                </div>
              )}
            </section>

            <section ref={reservationsRef} className="space-y-3 scroll-mt-20">
              <button 
                type="button"
                onClick={() => toggleSection('reservations')}
                className="flex w-full items-center justify-between text-left"
              >
                <div className="flex items-center gap-2 font-semibold text-ink">
                  <CalendarCheck size={18} className="text-primary" />
                  <span>Reservations</span>
                </div>
                {expandedSections.reservations ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>
              
              {expandedSections.reservations && (
                <div className="space-y-4">
                  {reservations.map((r) => (
                    <div key={r.id} className="glass rounded-xl p-4 space-y-3 relative border border-subtle">
                      <button 
                        type="button"
                        onClick={() => removeReservation(r.id)}
                        className="absolute top-2 right-2 text-muted hover:text-danger p-1"
                      >
                        <Trash2 size={16} />
                      </button>
                      <input 
                        placeholder="e.g. Table for 4, Museum Tickets"
                        value={r.title}
                        onChange={e => setReservations(rs => rs.map(x => x.id === r.id ? {...x, title: e.target.value} : x))}
                        className="roamly-input w-full px-3 py-2 text-sm font-medium focus:border-primary focus:outline-none"
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <input 
                          placeholder="Provider / Venue"
                          value={r.provider}
                          onChange={e => setReservations(rs => rs.map(x => x.id === r.id ? {...x, provider: e.target.value} : x))}
                          className="roamly-input w-full px-3 py-2 text-sm focus:border-primary focus:outline-none"
                        />
                        <input 
                          placeholder="Confirmation #"
                          value={r.confirmationNumber}
                          onChange={e => setReservations(rs => rs.map(x => x.id === r.id ? {...x, confirmationNumber: e.target.value} : x))}
                          className="roamly-input w-full px-3 py-2 text-sm focus:border-primary focus:outline-none"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase text-muted">Date & Time</label>
                          <div className="flex gap-1">
                            <input type="date" value={r.date} onChange={e => setReservations(rs => rs.map(x => x.id === r.id ? {...x, date: e.target.value} : x))} className="roamly-input roamly-date-input flex-1 px-2 py-2 text-xs focus:border-primary focus:outline-none" />
                            <input type="time" value={r.time} onChange={e => setReservations(rs => rs.map(x => x.id === r.id ? {...x, time: e.target.value} : x))} className="roamly-input w-20 px-2 py-2 text-xs focus:border-primary focus:outline-none" />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  <button type="button" onClick={addReservation} className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-subtle py-3 text-sm font-medium text-muted hover:border-primary hover:text-primary transition-colors">
                    <Plus size={16} />
                    <span>Add Reservation</span>
                  </button>
                </div>
              )}
            </section>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl bg-primary/10 p-4 flex gap-3 items-start">
              <Sparkles size={20} className="text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-primary">Lazy Parse</p>
                <p className="text-xs text-primary/70">Paste your flight or hotel confirmation email and we&apos;ll extract the details for you.</p>
              </div>
            </div>

            {!online && (
              <div className="rounded-xl bg-warning/10 p-3 flex gap-2 items-center text-xs text-warning border border-warning/20">
                <WifiOff size={14} />
                <span>Parse requires internet for AI. You are offline.</span>
              </div>
            )}

            {online && !providerInfo.available && (
              <div className="rounded-xl bg-warning/10 p-3 flex gap-2 items-center text-xs text-warning border border-warning/20">
                <AlertTriangle size={14} />
                <span>Using fallback parser — accuracy may be lower. Set up AI in Settings for better results.</span>
              </div>
            )}

            {!aiConsent && (
              <button 
                onClick={onShowConsent}
                className="flex items-center gap-2 rounded-xl bg-primary/10 p-3 text-xs text-primary border border-primary/20 w-full hover:bg-primary/20 transition-colors"
              >
                <ShieldAlert size={14} />
                <span>Paste parse requires consent — click here to learn more.</span>
              </button>
            )}
            
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Paste email text here…"
              rows={12}
              className="roamly-input w-full p-4 text-sm placeholder:text-gray-500 focus:border-primary focus:outline-none resize-none"
              disabled={isParsing || !aiConsent}
            />
            
            <div className="flex flex-col gap-2">
               <button
                  onClick={handlePasteParse}
                  disabled={!rawText.trim() || isParsing || !aiConsent}
                  className="touch-target w-full rounded-xl bg-primary py-4 font-bold text-white shadow-lg shadow-primary/20 disabled:opacity-40 disabled:shadow-none transition-all active:scale-[0.98]"
                >
                  {isParsing ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 size={20} className="animate-spin" /> Parsing…
                    </span>
                  ) : !online ? (
                    'Use offline parse'
                  ) : (
                    'Parse & Review'
                  )}
                </button>
                <p className="text-[10px] text-center text-muted px-4">
                  Prefer manual entry for 100% accuracy. AI parsing may occasionally miss details.
                </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer CTA (Manual only) */}
      {activeSection === 'manual' && (
        <div className="glass safe-area-bottom flex gap-3 px-4 py-3 border-t border-subtle shrink-0">
          <button
            onClick={onClose}
            className="touch-target rounded-xl bg-black/[0.06] px-6 py-3 text-sm font-semibold text-muted hover:bg-black/[0.10]"
          >
            Cancel
          </button>
          <button
            onClick={handleManualSave}
            disabled={isSaving}
            className="touch-target flex-1 rounded-xl bg-primary py-3 font-bold text-white shadow-lg shadow-primary/20 disabled:opacity-40 transition-all active:scale-[0.98]"
          >
            {isSaving ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 size={18} className="animate-spin" /> Saving…
              </span>
            ) : (
              'Save Trip'
            )}
          </button>
        </div>
      )}
    </div>
  );
}
