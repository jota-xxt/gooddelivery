import { useState, useRef, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Search, Loader2, MapPin } from 'lucide-react';

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
  type: string;
}

interface AddressSearchProps {
  onSelect: (lat: number, lng: number, address: string) => void;
  placeholder?: string;
  className?: string;
}

const AddressSearch = ({ onSelect, placeholder = 'Buscar endereço...', className }: AddressSearchProps) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const search = useCallback(async (q: string) => {
    if (q.length < 3) { setResults([]); setOpen(false); return; }
    setLoading(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5&countrycodes=br&accept-language=pt-BR`,
        { headers: { 'User-Agent': 'GoodDeliveryApp/1.0' } }
      );
      const data: NominatimResult[] = await res.json();
      setResults(data);
      setOpen(data.length > 0);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(value), 500);
  };

  const handleSelect = (r: NominatimResult) => {
    setQuery(r.display_name);
    setOpen(false);
    onSelect(parseFloat(r.lat), parseFloat(r.lon), r.display_name);
  };

  return (
    <div className={`relative ${className ?? ''}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={placeholder}
          className="pl-9 pr-9"
        />
        {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-[1000] mt-1 w-full rounded-lg border bg-popover shadow-lg max-h-60 overflow-auto">
          {results.map((r, i) => (
            <button
              key={i}
              className="flex items-start gap-2 w-full px-3 py-2.5 text-left hover:bg-accent transition-colors text-sm"
              onClick={() => handleSelect(r)}
            >
              <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
              <span className="line-clamp-2">{r.display_name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default AddressSearch;
