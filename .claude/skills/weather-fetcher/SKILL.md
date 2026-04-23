# Weather Fetcher Skill

## Description
Fetch the current temperature for Dubai, UAE in the requested unit (Celsius or Fahrenheit).

## Supported Units
- Celsius (°C)
- Fahrenheit (°F)

## API Details
- Uses Open-Meteo's free API (no authentication required)
- Dubai's coordinates: 25.2048°N, 55.2708°E
- Extracts the `current.temperature_2m` field from JSON responses

## Instructions
1. Fetch weather data via WebFetch using the appropriate Open-Meteo endpoint for the requested unit
2. Extract the temperature value from the `current.temperature_2m` field
3. Return temperature with appropriate unit label (°C or °F)

## Important Notes
- Only fetch the temperature, do not perform any transformations or write any files
- User-invocable: false (designed for internal/programmatic use)

## Example Response
Temperature for Dubai: 28.5°C
