// Import Mapbox as an ESM module
import mapboxgl from 'https://cdn.jsdelivr.net/npm/mapbox-gl@2.15.0/+esm';
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

// Check that Mapbox GL JS is loaded
console.log('Mapbox GL JS Loaded:', mapboxgl);

// Set your Mapbox access token here
mapboxgl.accessToken = 'pk.eyJ1IjoiZmxhdmlhZ3QiLCJhIjoiY21hcjR5emtpMDdjcjJtb2c5enZnZDVseiJ9.vkge6dDlUsHtfZpCU2BMCA';

// Initialize the map
const map = new mapboxgl.Map({
  container: 'map', // ID of the div where the map will render
  style: 'mapbox://styles/mapbox/streets-v12', // Map style
  center: [-71.09415, 42.36027], // [longitude, latitude]
  zoom: 12, // Initial zoom level
  minZoom: 5, // Minimum allowed zoom
  maxZoom: 18, // Maximum allowed zoom
});

// Define reusable bike lane style
const bikeLaneStyle = {
  'line-color': '#32D400', // Bright green
  'line-width': 5, // Thicker lines
  'line-opacity': 0.6, // 60% opacity
};

// Helper function to convert station coordinates to pixel positions
function getCoords(station) {
  const point = new mapboxgl.LngLat(+station.lon, +station.lat); // Convert lon/lat to Mapbox LngLat
  const { x, y } = map.project(point); // Project to pixel coordinates
  return { cx: x, cy: y }; // Return as object for use in SVG attributes
}

map.on('load', async () => {
    map.addSource('boston_route', {
        type: 'geojson',
        data: 'https://bostonopendata-boston.opendata.arcgis.com/datasets/boston::existing-bike-network-2022.geojson',
    });

    map.addLayer({
        id: 'boston-bike-lanes',
        type: 'line', 
        source: 'boston_route',
        paint: bikeLaneStyle,
    });
    
    map.addSource('cambridge_route', {
        type: 'geojson',
        data: 'https://raw.githubusercontent.com/cambridgegis/cambridgegis_data/main/Recreation/Bike_Facilities/RECREATION_BikeFacilities.geojson', // Cambridge bike lane GeoJSON
    });

    // Add Cambridge bike lanes layer
    map.addLayer({
        id: 'cambridge-bike-lanes',
        type: 'line',
        source: 'cambridge_route',
        paint: bikeLaneStyle,
    });
    
    // Fetch and parse Bluebikes station JSON data
  let jsonData;
  try {
    const jsonurl = 'https://dsc106.com/labs/lab07/data/bluebikes-stations.json';
    jsonData = await d3.json(jsonurl);
    console.log('Loaded JSON Data:', jsonData); // Log to verify structure
  } catch (error) {
    console.error('Error loading JSON:', error); // Handle errors
  }

  // Access the stations array
  let stations = jsonData.data.stations;
  console.log('Stations Array:', stations);

  // Fetch and parse Bluebikes traffic CSV data
  let trips;
  try {
    const csvurl = 'https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv';
    trips = await d3.csv(csvurl);
    console.log('Loaded Traffic Data:', trips); // Log to verify structure
  } catch (error) {
    console.error('Error loading CSV:', error); // Handle errors
  }

  // Calculate departures and arrivals using d3.rollup
  const departures = d3.rollup(
    trips,
    (v) => v.length,
    (d) => d.start_station_id
  );

  const arrivals = d3.rollup(
    trips,
    (v) => v.length,
    (d) => d.end_station_id
  );

  // Add traffic properties to stations
  stations = stations.map((station) => {
    let id = station.short_name;
    station.arrivals = arrivals.get(id) ?? 0;
    station.departures = departures.get(id) ?? 0;
    station.totalTraffic = (station.arrivals + station.departures) ?? 0;
    return station;
  });
  console.log('Stations with Traffic:', stations); // Log to verify properties

  // Create a square root scale for circle radii
  const radiusScale = d3
    .scaleSqrt()
    .domain([0, d3.max(stations, (d) => d.totalTraffic)])
    .range([0, 25]);

  // Select the SVG element inside the map container
  const svg = d3.select('#map').select('svg');

  // Append circles to the SVG for each station
  const circles = svg
  .selectAll('circle')
  .data(stations)
  .enter()
  .append('circle')
  .attr('r', (d) => radiusScale(d.totalTraffic))
  .attr('fill', 'steelblue')
  .attr('stroke', 'white')
  .attr('stroke-width', 1)
  .attr('fill-opacity', 0.6)
  .each(function (d) {
    d3.select(this)
      .append('title')
      .text(
        `${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`
      );
  });

  // Function to update circle positions when the map moves/zooms
  function updatePositions() {
    circles
      .attr('cx', (d) => getCoords(d).cx) // Set the x-position
      .attr('cy', (d) => getCoords(d).cy); // Set the y-position
  }

  // Initial position update
  updatePositions();

  // Reposition markers on map interactions
  map.on('move', updatePositions);
map.on('zoom', () => {
  console.log('Zoom event triggered, current zoom:', map.getZoom());
  updatePositions();
});
map.on('resize', updatePositions);
map.on('moveend', updatePositions);
});