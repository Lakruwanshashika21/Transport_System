import { useState, useCallback } from 'react';
import { GoogleMap, LoadScript, DirectionsService, DirectionsRenderer } from '@react-google-maps/api';

// Get API Key from .env
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

const containerStyle = {
  width: '100%',
  height: '100%',
  borderRadius: '0.75rem',
  position: 'relative' as const
};

const center = {
  lat: 6.9271, // Default to Colombo
  lng: 79.8612
};

interface MapComponentProps {
  pickup: string;
  destination: string;
  onDistanceCalculated?: (distanceText: string, distanceValue: number) => void;
  // New Prop: If true, we assume parent loaded the script
  manualScriptLoad?: boolean; 
}

export function MapComponent({ pickup, destination, onDistanceCalculated, manualScriptLoad = false }: MapComponentProps) {
  const [response, setResponse] = useState<google.maps.DirectionsResult | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);

  const directionsCallback = useCallback((
    result: google.maps.DirectionsResult | null,
    status: google.maps.DirectionsStatus
  ) => {
    if (status === 'OK' && result) {
      setResponse(result);
      setMapError(null);
      
      // Calculate distance and duration
      const route = result.routes[0]?.legs[0];
      if (route && onDistanceCalculated) {
        onDistanceCalculated(route.distance?.text || '', route.distance?.value || 0);
      }
    } else {
      console.error(`Directions request failed due to ${status}`);
      if (status === 'ZERO_RESULTS') {
        setMapError("No route found between these locations.");
      } else if (status !== 'OK') {
        // Don't show error on initial load if empty
        if (pickup && destination) setMapError(`Route Error: ${status}`);
      }
    }
  }, [pickup, destination, onDistanceCalculated]);

  // The actual map render function
  const renderMap = () => (
    <GoogleMap
      mapContainerStyle={containerStyle}
      center={center}
      zoom={10}
    >
      {mapError && (
        <div className="absolute top-2 left-2 right-2 z-10 bg-red-50 border border-red-200 text-red-600 px-4 py-2 rounded-lg text-sm shadow-sm text-center">
          {mapError}
        </div>
      )}

      {pickup && destination && (
        <DirectionsService
          options={{
            destination: destination,
            origin: pickup,
            travelMode: 'DRIVING' as google.maps.TravelMode
          }}
          callback={directionsCallback}
        />
      )}

      {response && (
        <DirectionsRenderer
          options={{
            directions: response
          }}
        />
      )}
    </GoogleMap>
  );

  // If parent loaded the script, just render map
  if (manualScriptLoad) {
    return renderMap();
  }

  // Otherwise, load script here (fallback for other pages)
  if (!GOOGLE_MAPS_API_KEY) {
     return <div className="p-4 text-center bg-gray-100 rounded-xl">Map Key Missing</div>;
  }

  return (
    <LoadScript googleMapsApiKey={GOOGLE_MAPS_API_KEY} onError={() => setMapError("Failed to load Map API")}>
      {renderMap()}
    </LoadScript>
  );
}