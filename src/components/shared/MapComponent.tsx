import { useState, useEffect, useCallback } from 'react';
import { GoogleMap, LoadScript, DirectionsService, DirectionsRenderer } from '@react-google-maps/api';

// Get API Key from .env
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

const containerStyle = {
  width: '100%',
  height: '100%',
  borderRadius: '0.75rem'
};

const center = {
  lat: 6.9271, // Default to Colombo
  lng: 79.8612
};

interface MapComponentProps {
  pickup: string;
  destination: string;
  onDistanceCalculated?: (distanceText: string, distanceValue: number) => void; // Callback to send distance back to parent
}

export function MapComponent({ pickup, destination, onDistanceCalculated }: MapComponentProps) {
  const [response, setResponse] = useState<google.maps.DirectionsResult | null>(null);

  const directionsCallback = useCallback((
    result: google.maps.DirectionsResult | null,
    status: google.maps.DirectionsStatus
  ) => {
    if (status === 'OK' && result) {
      setResponse(result);
      
      // Calculate distance and duration
      const route = result.routes[0]?.legs[0];
      if (route && onDistanceCalculated) {
        // Send back "12 km" and 12000 (meters)
        onDistanceCalculated(route.distance?.text || '', route.distance?.value || 0);
      }
    } else {
      console.error(`Directions request failed due to ${status}`);
    }
  }, [onDistanceCalculated]);

  // Only rendering the map if we have an API key
  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <div className="w-full h-full bg-gray-100 flex items-center justify-center rounded-xl">
        <p className="text-gray-500 text-center px-4">
          Google Maps API Key missing in .env file.<br/>
          (VITE_GOOGLE_MAPS_API_KEY)
        </p>
      </div>
    );
  }

  return (
    <LoadScript googleMapsApiKey={GOOGLE_MAPS_API_KEY}>
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={center}
        zoom={10}
      >
        {pickup && destination && (
          <DirectionsService
            // required
            options={{
              destination: destination,
              origin: pickup,
              travelMode: 'DRIVING' as google.maps.TravelMode
            }}
            // required
            callback={directionsCallback}
          />
        )}

        {response && (
          <DirectionsRenderer
            // required
            options={{
              directions: response
            }}
          />
        )}
      </GoogleMap>
    </LoadScript>
  );
}