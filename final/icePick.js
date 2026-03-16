// ~~~~~ GLOBAL VARIABLES ~~~~~

// ----- Dataset Preperation -----

// Central point of region of interest (decimal degrees)
var coords = {
  lon: -132.49348, // Longitude (positive is E, negative is W)
  lat: 56.77551 // Latitude (positive is N, negative is S)
};

// Extent of region of interest (m)
var bounds = 2000;

// Time window for image collection (YYYY-MM-DD)
var timeWindow = {
  startDate: '2025-05-01', // Earliest possible
  endDate: '2025-06-01' // Latest possible
};

// Satellite and sensor parameters (enter "null" to skip)
var satParams = {
  instrumentMode: 'IW', // 'IW' (Interferometric Wide) or 'EW' (Extra Wide)
  polarization: 'VV', // 'VV', 'VH', 'HH', or 'HV'
  orbitPass: null // 'DESCENDING' or 'ASCENDING'
};

// ----- Land Mask -----

// Water occurance threshold (percentage)
var maskThresh = 95;

// Shrink the mask to exclude more land (m)
var shrink = 130;

// ----- Preprocessing -----

// Median filter parameters
var medianParams = {
  radius: 1,
  kernelType: 'circle',
  units: 'pixels'
}

// ----- Connected Component Detection -----

// Amplitude threshold (dB)
var ampThresh = -16;

// Minimum number of connected pixels (size of icebergs m^2)
var minimumPixelCount = 5; // Lower bound
var maximumPixelCount = 30; // Upper bound
var searchSize = 256;

// Shape of kernel to check for connected neighbors
var connectedness = ee.Kernel.square(1); // (square, plus)

// GLCM texture thresholding
var glcmSwitch = 1; // Turn on/off GLCM texture thresholdig (boolean)
var homogeneityThresh = 0.01; // How similar neighboring pixel values tend to be (high pass filter)
var entropyThresh = 4.5; // Disorder in spatial pixel value pairings (low pass filter)
var glcmSize = 3; // Size of neighborhood for calculating gray-level co-occurance matrix

// Morphological opening - removes narrow bridges
var morphSwitch = 1 // Turn on/off morphological opening (boolean)
var morphPixels = 1 // Number of pixels to shrink > redialte

// ----- Post-Processing -----

// Compactness filter
var compactnessSwitch = 1 // Turn on/off compactness filtering (boolean)
var minCompactness = 0.3 // Minimum compactness (0.0 to 1.0)

// ----- Visualization -----

// Map zoom
var zoomLevel = 14;

// Palette for label symbology (random - currently unused)
var brightPalette = [
  'FF0000', 'FF4400', 'FF8800', 'FFAA00',
  'FFCC00', 'FFFF00', 'CCFF00', '88FF00',
  '44FF00', '00FF00', '00FF44', '44FF44',
  'FF4444', 'FF6622', 'FFAA44', 'FFDD44',
  'AAFF44', '88FF44', 'CCFF44', 'FF8844'
];

// Palette for area symbology (gradient)
var areaPalette = [
  'FFFF99', 'FFEE66', 'FFCC33', 'FFAA00',
  'FF8800', 'FF6600', 'FF4400', 'EE2200',
  'CC0000', '880000'
];


// Number of discrete bins for area histograms
var numBins = 25

// ~~~~~ APP INITIALIZATION ~~~~~

// ----- Theme -----

var theme = {
  bgDark:      '#E8E8E8',
  bgMid:       '#F2F2F2',
  bgLight:     '#FFFFFF',
  borderColor: '#CCCCCC',
  textPrimary: '#333333',
  textMuted:   '#666666',
  accent:      '#2E86AB',
  accentDark:  '#1B6584',
  runBg:       '#2E86AB',
  runText:     '#333333'
};

// ----- App Layout -----

// Clear previous session
ui.root.clear();

// Map styling
var map = ui.Map();
map.style().set('cursor', 'crosshair');
map.setOptions('SATELLITE');

// Sidebar styling
var sidebar = ui.Panel({
  style: {
    width: '320px',
    padding: '8px',
    backgroundColor: theme.bgDark
  }
});

// Split map and sidebar
var splitPanel = ui.SplitPanel({
  firstPanel: sidebar,
  secondPanel: map,
  orientation: 'horizontal',
  wipe: false
});

// Visualize split panel
ui.root.add(splitPanel);

// ----- Header -----

// Title
var title = ui.Label('icePick', {
  fontSize: '28px',
  fontWeight: 'bold',
  color: theme.accent,
  backgroundColor: theme.bgDark,
  margin: '10px 0px 2px 8px'
});

// Subtitle
var subtitle = ui.Label('An experimental tool for automatic iceberg extraction and statistical analysis', {
  fontSize: '11px',
  fontWeight: 'bold',
  fontStyle: 'italic',
  color: theme.textMuted,
  backgroundColor: theme.bgDark,
  margin: '0px 0px 10px 8px'
});

// Author
var author = ui.Label('by Marcel Rodriguez-Riccelli', {
  fontSize: '11px',
  fontWeight: 'bold',
  fontStyle: 'italic',
  color: theme.textMuted,
  backgroundColor: theme.bgDark,
  margin: '0px 0px 10px 8px'
});

// Description
var mainDescription = ui.Label('Choose an area of interest and establish a time window; icePick will extract components (which ideally represent icebergs) from available Sentinel-1 satellite imagery over that timespan. Parameters can be optinally tuned to improve detection—different areas will require different parameter values for optimal detection. Click the "Run Analysis" button at the button to begin the component detection process. If the analysis returns components, additional buttons appear that allow the user to produce histograms and export a CSV file containing counts of binned component areas per date and cumulative across all dates.', {
  fontSize: '10px',
  fontStyle: 'italic',
  color: theme.textMuted,
  backgroundColor: theme.bgDark,
  margin: '0px 0px 10px 8px'
});

// Divider line
var divider = ui.Panel({
  style: {
    height: '1px',
    backgroundColor: theme.borderColor,
    margin: '0px 8px 14px 8px',
    stretch: 'horizontal'
  }
});

sidebar.add(title);
sidebar.add(subtitle);
sidebar.add(author);
sidebar.add(mainDescription);
sidebar.add(divider);

// ----- Region of Interest Card -----

// Region of interest main label
var coordsLabel = ui.Label('Region of Interest', {
  fontSize: '13px',
  fontWeight: 'bold',
  color: theme.textPrimary,
  backgroundColor: theme.bgMid,
  margin: '0px 0px 8px 0px'
});

// Region of interest card description
var coordsDescription = ui.Label('Select a point of interest and the extent around that point to set search area', {
  fontSize: '10px',
  fontStyle: 'italic',
  color: theme.textMuted,
  backgroundColor: theme.bgMid,
  margin: '0px 0px 8px 0px'
});

// Longitude label
var lonLabel = ui.Label('Longitude', {
  fontSize: '11px',
  color: theme.textMuted,
  backgroundColor: theme.bgMid,
  margin: '0px 0px 2px 0px'
});

// Longitude field
var lonBox = ui.Textbox({
  value: String(coords.lon),
  style: {
    width: '120px',
    margin: '0px 0px 8px 0px',
    backgroundColor: theme.bgLight,
    color: theme.textPrimary
  }
});

// Latitude label
var latLabel = ui.Label('Latitude', {
  fontSize: '11px',
  color: theme.textMuted,
  backgroundColor: theme.bgMid,
  margin: '0px 0px 2px 0px'
});

// Latitude field
var latBox = ui.Textbox({
  value: String(coords.lat),
  style: {
    width: '120px',
    margin: '0px 0px 10px 0px',
    backgroundColor: theme.bgLight,
    color: theme.textPrimary
  }
});

// Click-to-pick button
var pickButton = ui.Button({
  label: 'Click on Map',
  style: {
    margin: '0px 0px 4px 0px',
    color: theme.accent,
    backgroundColor: theme.bgLight
  }
});

// Feedback tex on click-to-pick
var pickFeedback = ui.Label('', {
  fontSize: '10px',
  color: theme.accentDark,
  backgroundColor: theme.bgMid,
  margin: '0px 0px 12px 0px'
});

// Behavior when click-to-pick is selected
pickButton.onClick(function() {
  pickFeedback.setValue('Click a location on the map...');
  map.onClick(function(coords) {
    lonBox.setValue(coords.lon.toFixed(5));
    latBox.setValue(coords.lat.toFixed(5));
    pickFeedback.setValue('✔ Location set: ' + coords.lat.toFixed(5) + ', ' + coords.lon.toFixed(5));
    map.onClick(null);
  });
});

// Bounds label
var boundsLabel = ui.Label('Bounds', {
  fontSize: '11px',
  fontWeight: 'bold',
  color: theme.textPrimary,
  backgroundColor: theme.bgMid,
  margin: '0px 0px 4px 0px'
});

// Bounds details
var boundsReadout = ui.Label('Radius (m)', {
  fontSize: '11px',
  color: theme.accent,
  backgroundColor: theme.bgMid,
  margin: '0px 0px 2px 0px'
});

// Bounds slider
var boundsSlider = ui.Slider({
  min: 500,
  max: 5000,
  value: bounds,
  step: 100,
  style: {width: '280px', margin: '0px 0px 0px 0px'}
});

// Card assembly & stylization
var coordsCard = ui.Panel({
  widgets: [
    coordsLabel, coordsDescription,
    lonLabel, lonBox,
    latLabel, latBox,
    pickButton, pickFeedback,
    boundsLabel, boundsReadout, boundsSlider
  ],
  style: {
    backgroundColor: theme.bgMid,
    border: '1px solid ' + theme.borderColor,
    margin: '0px 0px 10px 0px',
    padding: '10px'
  }
});

sidebar.add(coordsCard);

// ----- Time Window Card -----

// Time windowcard main label
var dateLabel = ui.Label('Time Window', {
  fontSize: '13px',
  fontWeight: 'bold',
  color: theme.textPrimary,
  backgroundColor: theme.bgMid,
  margin: '0px 0px 8px 0px'
});

// Time window card description
var dateDescription = ui.Label('Set earliest and latest extents of search window (a large window may result in long load times)', {
  fontSize: '10px',
  fontStyle: 'italic',
  color: theme.textMuted,
  backgroundColor: theme.bgMid,
  margin: '0px 0px 8px 0px'
});

// Start date label
var startDateLabel = ui.Label('Start Date', {
  fontSize: '11px',
  color: theme.textMuted,
  backgroundColor: theme.bgMid,
  margin: '0px 0px 2px 0px'
});

// Start date box
var startDateBox = ui.Textbox({
  value: timeWindow.startDate,
  placeholder: 'YYYY-MM-DD',
  style: {
    width: '120px',
    margin: '0px 0px 10px 0px',
    backgroundColor: theme.bgLight,
    color: theme.textPrimary
  }
});

// End date label
var endDateLabel = ui.Label('End Date', {
  fontSize: '11px',
  color: theme.textMuted,
  backgroundColor: theme.bgMid,
  margin: '0px 0px 2px 0px'
});

// End date box
var endDateBox = ui.Textbox({
  value: timeWindow.endDate,
  placeholder: 'YYYY-MM-DD',
  style: {
    width: '120px',
    margin: '0px 0px 0px 0px',
    backgroundColor: theme.bgLight,
    color: theme.textPrimary
  }
});

// Time window card assembly & stylization
var dateCard = ui.Panel({
  widgets: [
    dateLabel, dateDescription,
    startDateLabel, startDateBox,
    endDateLabel, endDateBox
  ],
  style: {
    backgroundColor: theme.bgMid,
    border: '1px solid ' + theme.borderColor,
    margin: '0px 0px 10px 0px',
    padding: '10px'
  }
});

sidebar.add(dateCard);

// ----- Satellite Parameters Card -----

// Satellite parameters card main label
var satLabel = ui.Label('Satellite Parameters', {
  fontSize: '13px',
  fontWeight: 'bold',
  color: theme.textPrimary,
  backgroundColor: theme.bgMid,
  margin: '0px 0px 8px 0px'
});

// Satellite parameters card description
var satDescription = ui.Label('Filter available imagery by desired satellite parameters (may need adjustment if no images are returned for a given area)', {
  fontSize: '10px',
  fontStyle: 'italic',
  color: theme.textMuted,
  backgroundColor: theme.bgMid,
  margin: '0px 0px 8px 0px'
});

// Insturment mode label
var instrumentModeLabel = ui.Label('Instrument Mode', {
  fontSize: '11px',
  color: theme.textMuted,
  backgroundColor: theme.bgMid,
  margin: '0px 0px 2px 0px'
});

// Instrument mode menu
var instrumentModeSelect = ui.Select({
  items: [
    {label: 'Any', value: 'ANY'},
    {label: 'IW - Interferometric Wide', value: 'IW'},
    {label: 'EW - Extra Wide', value: 'EW'}
  ],
  value: satParams.instrumentMode,
  style: {width: '280px', margin: '0px 0px 10px 0px'}
});

// Polarization label
var polarizationLabel = ui.Label('Polarization', {
  fontSize: '11px',
  color: theme.textMuted,
  backgroundColor: theme.bgMid,
  margin: '0px 0px 2px 0px'
});

// Polarization menu
var polarizationSelect = ui.Select({
  items: [
    {label: 'VV', value: 'VV'},
    {label: 'VH', value: 'VH'},
    {label: 'HH', value: 'HH'},
    {label: 'HV', value: 'HV'}
  ],
  value: satParams.polarization,
  style: {width: '280px', margin: '0px 0px 10px 0px'}
});

// Orbit label
var orbitPassLabel = ui.Label('Orbit Pass', {
  fontSize: '11px',
  color: theme.textMuted,
  backgroundColor: theme.bgMid,
  margin: '0px 0px 2px 0px'
});

// Orbit menu
var orbitPassSelect = ui.Select({
  items: [
    {label: 'Any', value: 'ANY'},
    {label: 'Ascending', value: 'ASCENDING'},
    {label: 'Descending', value: 'DESCENDING'}
  ],
  value: 'ANY',
  style: {width: '280px', margin: '0px 0px 0px 0px'}
});

// Satellite card assembly & stylization
var satCard = ui.Panel({
  widgets: [
    satLabel, satDescription,
    instrumentModeLabel, instrumentModeSelect,
    polarizationLabel, polarizationSelect,
    orbitPassLabel, orbitPassSelect
  ],
  style: {
    backgroundColor: theme.bgMid,
    border: '1px solid ' + theme.borderColor,
    margin: '0px 0px 10px 0px',
    padding: '10px'
  }
});

sidebar.add(satCard);

// ----- Land Mask Card -----

// Land mask card main label
var landMaskLabel = ui.Label('Land Mask', {
  fontSize: '13px',
  fontWeight: 'bold',
  color: theme.textPrimary,
  backgroundColor: theme.bgMid,
  margin: '0px 0px 8px 0px'
});

// Land mask card description
var landMaskDescription = ui.Label('Determine the extents of the mask used to block out land pixels from consideration; the water occurance threshold masks out pixels where water occurs some percentage of the time—and the shrink distance extends that mask into the water by the desired distance', {
  fontSize: '10px',
  fontStyle: 'italic',
  color: theme.textMuted,
  backgroundColor: theme.bgMid,
  margin: '0px 0px 8px 0px'
});

// Occurance threshold label
var maskThreshLabel = ui.Label('Water Occurrence', {
  fontSize: '11px',
  color: theme.textMuted,
  backgroundColor: theme.bgMid,
  margin: '0px 0px 2px 0px'
});

// Mask threshold details
var maskThreshReadout = ui.Label('Threshold (%)', {
  fontSize: '11px',
  color: theme.accent,
  backgroundColor: theme.bgMid,
  margin: '0px 0px 2px 0px'
});

// Mask threshold slider
var maskThreshSlider = ui.Slider({
  min: 0,
  max: 100,
  value: maskThresh,
  step: 1,
  style: {width: '280px', margin: '0px 0px 10px 0px'}
});

// Mask edge shrink label
var shrinkLabel = ui.Label('Mask Edge Shrink', {
  fontSize: '11px',
  color: theme.textMuted,
  backgroundColor: theme.bgMid,
  margin: '0px 0px 2px 0px'
});

// Mask edge shrink details
var shrinkReadout = ui.Label('Distance (m)', {
  fontSize: '11px',
  color: theme.accent,
  backgroundColor: theme.bgMid,
  margin: '0px 0px 2px 0px'
});

// Mask edge shrink slider
var shrinkSlider = ui.Slider({
  min: 0,
  max: 500,
  value: shrink,
  step: 10,
  style: {width: '280px', margin: '0px 0px 0px 0px'}
});

// Land mask card assembly & stylization
var landMaskCard = ui.Panel({
  widgets: [
    landMaskLabel, landMaskDescription,
    maskThreshLabel, maskThreshReadout, maskThreshSlider,
    shrinkLabel, shrinkReadout, shrinkSlider
  ],
  style: {
    backgroundColor: theme.bgMid,
    border: '1px solid ' + theme.borderColor,
    margin: '0px 0px 10px 0px',
    padding: '10px'
  }
});

sidebar.add(landMaskCard);

// ----- Preprocessing Card -----

// Preprocessing card main label
var preprocessLabel = ui.Label('Preprocessing', {
  fontSize: '13px',
  fontWeight: 'bold',
  color: theme.textPrimary,
  backgroundColor: theme.bgMid,
  margin: '0px 0px 8px 0px'
});

// Preprocessing card description
var preprocessingDescription = ui.Label('Cleans up speckle interference noise artifacts in SAR imagery—too much filtering may group together growlers / bergy bits and negatively affect connected component detection', {
  fontSize: '10px',
  fontStyle: 'italic',
  color: theme.textMuted,
  backgroundColor: theme.bgMid,
  margin: '0px 0px 8px 0px'
});

// Median filter radius label
var medianRadiusLabel = ui.Label('Filter Radius', {
  fontSize: '11px',
  color: theme.textMuted,
  backgroundColor: theme.bgMid,
  margin: '0px 0px 2px 0px'
});

// Median filter radius details
var medianRadiusReadout = ui.Label('Units defined below', {
  fontSize: '11px',
  color: theme.accent,
  backgroundColor: theme.bgMid,
  margin: '0px 0px 2px 0px'
});

// Median filter radius slider
var medianRadiusSlider = ui.Slider({
  min: 1,
  max: 10,
  value: medianParams.radius,
  step: 1,
  style: {width: '280px', margin: '0px 0px 10px 0px'}
});

// Kernel type label
var kernelTypeLabel = ui.Label('Kernel Type', {
  fontSize: '11px',
  color: theme.textMuted,
  backgroundColor: theme.bgMid,
  margin: '0px 0px 2px 0px'
});

// Kernel type menu
var kernelTypeSelect = ui.Select({
  items: [
    {label: 'Circle', value: 'circle'},
    {label: 'Square', value: 'square'}
  ],
  value: medianParams.kernelType,
  style: {width: '280px', margin: '0px 0px 10px 0px'}
});

// Kernel units label
var kernelUnitsLabel = ui.Label('Kernel Units', {
  fontSize: '11px',
  color: theme.textMuted,
  backgroundColor: theme.bgMid,
  margin: '0px 0px 2px 0px'
});

// Kernel units menu
var kernelUnitsSelect = ui.Select({
  items: [
    {label: 'Pixels', value: 'pixels'},
    {label: 'Meters', value: 'meters'}
  ],
  value: medianParams.units,
  style: {width: '280px', margin: '0px 0px 0px 0px'}
});

// Preprocessing card assembly & visualization
var preprocessCard = ui.Panel({
  widgets: [
    preprocessLabel, preprocessingDescription,
    medianRadiusLabel, medianRadiusReadout, medianRadiusSlider,
    kernelTypeLabel, kernelTypeSelect,
    kernelUnitsLabel, kernelUnitsSelect
  ],
  style: {
    backgroundColor: theme.bgMid,
    border: '1px solid ' + theme.borderColor,
    margin: '0px 0px 10px 0px',
    padding: '10px'
  }
});

sidebar.add(preprocessCard);

// ----- Connected Component Detection Card -----

// Connected component detection card main label
var ccdLabel = ui.Label('Component Detection', {
  fontSize: '13px',
  fontWeight: 'bold',
  color: theme.textPrimary,
  backgroundColor: theme.bgMid,
  margin: '0px 0px 8px 0px'
});

// Connected component detection description
var ccdDescription = ui.Label('Filtering and search parameters for connected component detection; this part of the algorithm removes all pixels that do not meet the criteria below, groups together pixels that remain connected into a component, and gives that component a label', {
  fontSize: '10px',
  fontStyle: 'italic',
  color: theme.textMuted,
  backgroundColor: theme.bgMid,
  margin: '0px 0px 8px 0px'
});

// Amplitude label
var ampThreshLabel = ui.Label('Amplitude Threshold', {
  fontSize: '11px',
  color: theme.textMuted,
  backgroundColor: theme.bgMid,
  margin: '0px 0px 2px 0px'
});

// Amplitude threshold details
var ampThreshReadout = ui.Label('Decibels (typically between -30 and 0)', {
  fontSize: '11px',
  color: theme.accent,
  backgroundColor: theme.bgMid,
  margin: '0px 0px 2px 0px'
});

// Amplitude threshold field
var ampThreshBox = ui.Textbox({
  value: String(ampThresh),
  style: {
    width: '120px',
    margin: '0px 0px 10px 0px',
    backgroundColor: theme.bgLight,
    color: theme.textPrimary
  }
});

// Pixel count label
var pixelCountSubLabel = ui.Label('Pixel Count Filter', {
  fontSize: '11px',
  fontWeight: 'bold',
  color: theme.textPrimary,
  backgroundColor: theme.bgMid,
  margin: '0px 0px 6px 0px'
});

// Minimum pixels label
var minPixelLabel = ui.Label('Minimum Pixels', {
  fontSize: '11px',
  color: theme.textMuted,
  backgroundColor: theme.bgMid,
  margin: '0px 0px 2px 0px'
});

// Minimum pixels slider
var minPixelSlider = ui.Slider({
  min: 1,
  max: 20,
  value: minimumPixelCount,
  step: 1,
  style: {width: '280px', margin: '0px 0px 10px 0px'}
});

// Maximum pixels label
var maxPixelLabel = ui.Label('Maximum Pixels', {
  fontSize: '11px',
  color: theme.textMuted,
  backgroundColor: theme.bgMid,
  margin: '0px 0px 2px 0px'
});

// Maximum pixels slider
var maxPixelSlider = ui.Slider({
  min: 10,
  max: 200,
  value: maximumPixelCount,
  step: 1,
  style: {width: '280px', margin: '0px 0px 10px 0px'}
});

// Search parameters label
var searchSubLabel = ui.Label('Search Parameters', {
  fontSize: '11px',
  fontWeight: 'bold',
  color: theme.textPrimary,
  backgroundColor: theme.bgMid,
  margin: '0px 0px 6px 0px'
});

// Search size label
var searchSizeLabel = ui.Label('Search Size', {
  fontSize: '11px',
  color: theme.textMuted,
  backgroundColor: theme.bgMid,
  margin: '0px 0px 2px 0px'
});

// Search size details
var searchSizeReadout = ui.Label('Number of pixels', {
  fontSize: '11px',
  color: theme.accent,
  backgroundColor: theme.bgMid,
  margin: '0px 0px 2px 0px'
});

// Search size menu
var searchSizeSelect = ui.Select({
  items: [
    {label: '64',  value: 64},
    {label: '128', value: 128},
    {label: '256', value: 256},
    {label: '512', value: 512}
  ],
  value: searchSize,
  style: {width: '280px', margin: '0px 0px 10px 0px'}
});

// Connectedness kernel shape label
var connectedLabel = ui.Label('Connectedness Kernel Shape', {
  fontSize: '11px',
  color: theme.textMuted,
  backgroundColor: theme.bgMid,
  margin: '0px 0px 2px 0px'
});

// Connectedness kernel shape menu
var connectedSelect = ui.Select({
  items: [
    {label: 'Square', value: 'square'},
    {label: 'Plus',   value: 'plus'}
  ],
  value: 'square',
  style: {width: '280px', margin: '0px 0px 10px 0px'}
});

// GLCM label
var glcmSubLabel = ui.Label('Grey-level Co-occurrence Matrix (GLCM) Texture Filter', {
  fontSize: '11px',
  fontWeight: 'bold',
  color: theme.textPrimary,
  backgroundColor: theme.bgMid,
  margin: '0px 0px 6px 0px'
});

// GLCM description
var glcmDescription = ui.Label('Compares value of a pixel to those around it to look for consistency', {
  fontSize: '10px',
  fontStyle: 'italic',
  color: theme.textMuted,
  backgroundColor: theme.bgMid,
  margin: '0px 0px 8px 0px'
});

// GLCM on/off
var glcmCheckbox = ui.Checkbox({
  label: 'Enable GLCM Filtering',
  value: glcmSwitch === 1,
  style: {
    color: theme.textPrimary,
    backgroundColor: theme.bgMid,
    margin: '0px 0px 8px 0px'
  }
});

// Homogeneity label
var homogeneityLabel = ui.Label('Homogeneity Threshold', {
  fontSize: '11px',
  color: theme.textMuted,
  backgroundColor: theme.bgMid,
  margin: '0px 0px 2px 0px'
});

// Homogeneity details
var homogeneityReadout = ui.Label('High pass / greater than', {
  fontSize: '11px',
  color: theme.accent,
  backgroundColor: theme.bgMid,
  margin: '0px 0px 2px 0px'
});

// Homogeneity slider
var homogeneitySlider = ui.Slider({
  min: 0,
  max: 1,
  value: homogeneityThresh,
  step: 0.01,
  style: {width: '280px', margin: '0px 0px 10px 0px'}
});

// Entropy label
var entropyLabel = ui.Label('Entropy Threshold', {
  fontSize: '11px',
  color: theme.textMuted,
  backgroundColor: theme.bgMid,
  margin: '0px 0px 2px 0px'
});

// Entropy details
var entropyReadout = ui.Label('Low pass / less than', {
  fontSize: '11px',
  color: theme.accent,
  backgroundColor: theme.bgMid,
  margin: '0px 0px 2px 0px'
});

// Entropy slider
var entropySlider = ui.Slider({
  min: 0,
  max: 10,
  value: entropyThresh,
  step: 0.1,
  style: {width: '280px', margin: '0px 0px 10px 0px'}
});

// Neighborhood size label
var glcmSizeLabel = ui.Label('Neighborhood Size', {
  fontSize: '11px',
  color: theme.textMuted,
  backgroundColor: theme.bgMid,
  margin: '0px 0px 2px 0px'
});

// Neighborhood size details
var glcmSizeReadout = ui.Label('Number of pixels', {
  fontSize: '11px',
  color: theme.accent,
  backgroundColor: theme.bgMid,
  margin: '0px 0px 2px 0px'
});

// Neighborhood size slider
var glcmSizeSlider = ui.Slider({
  min: 1,
  max: 7,
  value: glcmSize,
  step: 2,
  style: {width: '280px', margin: '0px 0px 10px 0px'}
});

// Morphological opening card main label
var morphSubLabel = ui.Label('Morphological Opening', {
  fontSize: '11px',
  fontWeight: 'bold',
  color: theme.textPrimary,
  backgroundColor: theme.bgMid,
  margin: '0px 0px 6px 0px'
});

// Morphological opening description
var morphDescription = ui.Label('Shrinks then re-extends the edges of remaining pixel groupings to break narrow bridges—may also remove small groups', {
  fontSize: '10px',
  fontStyle: 'italic',
  color: theme.textMuted,
  backgroundColor: theme.bgMid,
  margin: '0px 0px 8px 0px'
});

// Morphological opening on/off
var morphCheckbox = ui.Checkbox({
  label: 'Enable Morphological Opening',
  value: morphSwitch === 1,
  style: {
    color: theme.textPrimary,
    backgroundColor: theme.bgMid,
    margin: '0px 0px 8px 0px'
  }
});

// Shrink/redialate label
var morphPixelsLabel = ui.Label('Shrink / Redilate Size', {
  fontSize: '11px',
  color: theme.textMuted,
  backgroundColor: theme.bgMid,
  margin: '0px 0px 2px 0px'
});

// Shrink/redilate description
var morphPixelsReadout = ui.Label('Number of Pixels', {
  fontSize: '11px',
  color: theme.accent,
  backgroundColor: theme.bgMid,
  margin: '0px 0px 2px 0px'
});

// Shrink/redilate slider
var morphPixelsSlider = ui.Slider({
  min: 1,
  max: 5,
  value: morphPixels,
  step: 1,
  style: {width: '280px', margin: '0px 0px 0px 0px'}
});

// Connected component detection card assembly & visualization
var ccdCard = ui.Panel({
  widgets: [
    ccdLabel, ccdDescription,
    ampThreshLabel, ampThreshReadout, ampThreshBox,
    pixelCountSubLabel,
    minPixelLabel, minPixelSlider,
    maxPixelLabel, maxPixelSlider,
    searchSubLabel,
    searchSizeLabel, searchSizeReadout, searchSizeSelect,
    connectedLabel, connectedSelect,
    glcmSubLabel, glcmDescription,
    glcmCheckbox,
    homogeneityLabel, homogeneityReadout, homogeneitySlider,
    entropyLabel, entropyReadout, entropySlider,
    glcmSizeLabel, glcmSizeReadout, glcmSizeSlider,
    morphSubLabel, morphDescription,
    morphCheckbox,
    morphPixelsLabel, morphPixelsReadout, morphPixelsSlider
  ],
  style: {
    backgroundColor: theme.bgMid,
    border: '1px solid ' + theme.borderColor,
    margin: '0px 0px 10px 0px',
    padding: '10px'
  }
});

sidebar.add(ccdCard);

// ----- Post Processing Card -----

// Post processing card main label
var postProcessLabel = ui.Label('Post Processing', {
  fontSize: '13px',
  fontWeight: 'bold',
  color: theme.textPrimary,
  backgroundColor: theme.bgMid,
  margin: '0px 0px 8px 0px'
});

// Post processing description
var postProcessDescription = ui.Label('Filter components by a compactness score to remove long chains of clumped growlers / bergy bits; a circle is considered the most compact shape, and any other shape trades off perimeter for area—this filter compares the area/perimeter ratio of each component to that of a circle and scores it accordingly (less compact yields a lower score, and vise versa)', {
  fontSize: '10px',
  fontStyle: 'italic',
  color: theme.textMuted,
  backgroundColor: theme.bgMid,
  margin: '0px 0px 8px 0px'
});

// Compactness label
var compactnessSubLabel = ui.Label('Compactness Filter', {
  fontSize: '11px',
  fontWeight: 'bold',
  color: theme.textPrimary,
  backgroundColor: theme.bgMid,
  margin: '0px 0px 6px 0px'
});

// Compactness on/off
var compactnessCheckbox = ui.Checkbox({
  label: 'Enable Compactness Filtering',
  value: compactnessSwitch === 1,
  style: {
    color: theme.textPrimary,
    backgroundColor: theme.bgMid,
    margin: '0px 0px 8px 0px'
  }
});

// Minimum compactness label
var minCompactnessLabel = ui.Label('Minimum Compactness', {
  fontSize: '11px',
  color: theme.textMuted,
  backgroundColor: theme.bgMid,
  margin: '0px 0px 2px 0px'
});

// Minimum compactness details
var minCompactnessReadout = ui.Label('Normalized Isoperimetric Quotient Value', {
  fontSize: '11px',
  color: theme.accent,
  backgroundColor: theme.bgMid,
  margin: '0px 0px 2px 0px'
});

// Minimum compactness slider
var minCompactnessSlider = ui.Slider({
  min: 0,
  max: 1,
  value: minCompactness,
  step: 0.05,
  style: {width: '280px', margin: '0px 0px 0px 0px'}
});

// 
var postProcessCard = ui.Panel({
  widgets: [
    postProcessLabel, postProcessDescription,
    compactnessSubLabel,
    compactnessCheckbox,
    minCompactnessLabel, minCompactnessReadout, minCompactnessSlider
  ],
  style: {
    backgroundColor: theme.bgMid,
    border: '1px solid ' + theme.borderColor,
    margin: '0px 0px 10px 0px',
    padding: '10px'
  }
});

sidebar.add(postProcessCard);

// ----- Execute Code -----

// Status label, dynamically updates when code runs
var statusLabel = ui.Label('', {
  fontSize: '11px',
  color: theme.accent,
  backgroundColor: theme.bgDark,
  margin: '4px 0px 0px 0px'
});

// Run button
var runButton = ui.Button({
  label: '▶  Run Analysis',
  style: {
    margin: '4px 0px 4px 0px',
    color: theme.runText,
    backgroundColor: theme.runBg
  }
});

// Shows histograms if components are found
var resultsPanel = ui.Panel({
  style: {
    backgroundColor: theme.bgDark,
    margin: '0px 0px 0px 0px'
  }
});

sidebar.add(runButton);
sidebar.add(statusLabel);
sidebar.add(resultsPanel);

// ----- Histogram panel -----

// Chart overlay panel added to map when Show Histograms is clicked
var chartPanel = ui.Panel({
  style: {
    position: 'bottom-right',
    width: '420px',
    maxHeight: '500px',
    backgroundColor: theme.bgMid,
    border: '1px solid ' + theme.borderColor,
    padding: '8px',
    shown: false
  }
});

// Chart panel header row
var chartPanelHeader = ui.Panel({
  widgets: [
    ui.Label('Component Area Histograms', {
      fontSize: '13px',
      fontWeight: 'bold',
      color: theme.textPrimary,
      backgroundColor: theme.bgMid,
      margin: '0px 0px 0px 0px'
    }),
    ui.Button({
      label: '✕',
      onClick: function() { chartPanel.style().set('shown', false); },
      style: {
        margin: '0px 0px 0px 0px',
        color: theme.textMuted,
        backgroundColor: theme.bgMid
      }
    })
  ],
  layout: ui.Panel.Layout.Flow('horizontal'),
  style: {
    backgroundColor: theme.bgMid,
    margin: '0px 0px 8px 0px',
    stretch: 'horizontal'
  }
});

// Container for charts inside the panel
var chartContainer = ui.Panel({
  style: {
    backgroundColor: theme.bgMid,
    margin: '0px 0px 0px 0px'
  }
});

chartPanel.add(chartPanelHeader);
chartPanel.add(chartContainer);
map.add(chartPanel);

// ~~~~~ FUNCTIONS ~~~~~

// ----- Dataset Preperation -----

// Applies satellite / sensor filters to input collection based on parameters
function filterSatParams(collection){
  print('Filtering dataset based on satellite parameters...');
  statusLabel.setValue('Filtering dataset based on satellite parameters...');
  
  // If each parameter has a value other than null, then apply filter...
  if (satParams.instrumentMode) {
    collection = collection.filter(ee.Filter.eq('instrumentMode', satParams.instrumentMode));
  }
  if (satParams.polarization) {
    collection = collection.filter(ee.Filter.listContains('transmitterReceiverPolarisation', satParams.polarization));
  }
  if (satParams.orbitPass) {
    collection = collection.filter(ee.Filter.eq('orbitProperties_pass', satParams.orbitPass));
  }
  
  // Return filtered image collection
  return collection;
}

// ----- Land Mask -----

// Clip each image in input collection to bounding box
function clipToBoundingBox(collection, boundingBox) {
  print("Clipping images to bounding box...");
  statusLabel.setValue("Clipping images to bounding box...");
  
  // For each image in collection...
  var clippedCollection = collection.map(function(image) {
    
    // Clip each image to bounding box
    return image = image.clip(boundingBox);
  });
  print("Images clipped successfully.");
  statusLabel.setValue("Images clipped successfully.");
  
  // Return collection with each image clipped
  return clippedCollection;
}

// Removes all land pixels from each image in collection
function applyLandMask(collection, landMask) {
  print("Applying land mask to imagery...");
  statusLabel.setValue("Applying land mask to imagery...");
  
  // For each image in collection...
  var maskedCollection = collection.map(function(image) {
    
    // Apply the input mask to each image in input collection
    return image.updateMask(landMask);
  });
  print("Land mask applied successfully.");
  statusLabel.setValue("Land mask applied successfully.");
  
  // Return collection with land masked for each image
  return maskedCollection;
}

// ----- Preprocessing -----

// Applies a median filter to reduce speckling but maintains edges
function applyMedianFilter(collection) {
  print('Applying median filter...');
  statusLabel.setValue('Applying median filter...');
  
  // For each image in collection...
  var filtered = collection.map(function(image) {
    
    // Return image with median applied, make sure properties carry over
    return image.focalMedian(medianParams)
      .copyProperties(image, image.propertyNames());
  });
  
  // Return image collection with filter applied to each image
  print('Median filter applied successfully.');
  statusLabel.setValue('Median filter applied successfully.');
  return filtered;
}

// Add a band of GLCM texture measurements for filtering downstream
function addTextureBands(collection) {
  print('Computing GLCM texture features...');
  statusLabel.setValue('Computing GLCM texture features...');
  
  // Iterate through each image in the input collection
  var withTexture = collection.map(function(image) {
    
    // Convert dB -25 - 0 to 0 - 255 for glcmTexture
    var scaled = image.subtract(-25).divide(25).multiply(255)
      .clamp(0, 255).toInt();
      
    // Calculate GLCM matrix
    var glcm = scaled.glcmTexture({size: glcmSize});
    
    // Get original image projection so entropy and homogeneity pixels align
    var proj = image.projection();
    
  // Get entropy measurement
  var entropy = glcm.select(satParams.polarization + '_ent').rename('entropy').reproject({crs: proj, scale: 10});
  
  // Get homogeneity measurement
  var homogeneity = glcm.select(satParams.polarization + '_idm').rename('homogeneity').reproject({crs: proj, scale: 10});
  
      
    // Return image with bands added
    return image.addBands(entropy).addBands(homogeneity)
      .copyProperties(image, image.propertyNames());
  });
  
  // Return image collection with bands added to each image
  print('Texture features computed.');
  statusLabel.setValue('Texture features computed.');
  return withTexture;
}

// ----- Connected Component Detection -----

// Detect clusters of pixels that meet user defined thresholds
function getConnectedComponents(collection) {
  print('Detecting connected components...');
  statusLabel.setValue('Detecting connected components...');
  
  // For each image in collection...
  var componentCollection = collection.map(function(image) {
  
  // Apply the amplitude threshold
  var thresholded = image.select(satParams.polarization).gte(ampThresh);
  
  // If the GLCM switch is active...
  if (glcmSwitch == 1) {
    
    // Apply the entropy and homogeneity filters
    thresholded = thresholded
      .and(image.select('entropy').lte(entropyThresh))
      .and(image.select('homogeneity').gte(homogeneityThresh));
  }
        
    
    // If morphological opening switch is active, shrink and then redialate to break narrow bridges
    if (morphSwitch == 1) {
      thresholded = thresholded
      
        // Shrink
        .focal_min({radius: morphPixels, kernelType: 'circle', units: 'pixels'})
        
        // Redilate
        .focal_max({radius: morphPixels, kernelType: 'circle', units: 'pixels'});
    }
      
    // Find connected components
    var connected = thresholded.connectedComponents({
      connectedness: connectedness,
      maxSize: searchSize
    });
    
    // Filter small components
    var pixelCount = connected.select('labels').connectedPixelCount(searchSize);
    var sizeFiltered = connected.updateMask(
      pixelCount.gte(minimumPixelCount).and(pixelCount.lte(maximumPixelCount))
    );
    
    // Return an image with everything but components masked and component pixels labeled
    return sizeFiltered;
  });
  
  // Return a collection of filtered component images
  print('Connected component detection complete.');
  statusLabel.setValue('Connected component detection complete.');
  return componentCollection;
}

// ----- Post-Processing -----

// Turn components into vectors for spatial analysis and compactness filtering
function vectorizeComponents(imageCollection, boundingBox) {
  print('Vectorizing components...');
  statusLabel.setValue('Vectorizing components...');
  
  // Convert to list for iteration
  var imageList = imageCollection.toList(imageCollection.size());
  
  // Get number of images
  var size = imageCollection.size();
  
  // For each image in collection...
  var featureCollections = ee.List.sequence(0, size.subtract(1)).map(function(index) {
    
    // Get image from collection at index
    var image = ee.Image(imageList.get(index));
    
    // Vectorize components based on labeled groupings
    var vectors = image.select('labels').toInt().reduceToVectors({
      scale: 10,
      geometry: boundingBox,
      geometryType: 'polygon',
      eightConnected: false,
      labelProperty: 'label',
      maxPixels: 1e8
    });
    
    // Append to list for iteration
    var vectorList = vectors.toList(vectors.size());
    
    // Reindex all components (label values are lost in vectorization)
    var reindexed = ee.List.sequence(0, vectors.size().subtract(1)).map(function(i) {
      return ee.Feature(vectorList.get(i)).set('label', i);
    });
    
    // Return the reindexed component list
    return ee.FeatureCollection(reindexed);
  });
  
  // Return a feature collection of vectorized components for each image
  print('Vectorization complete.');
  statusLabel.setValue('Vectorization complete.');
  return featureCollections;
}

// Filter components based on a measurement of compactness
function filterByCompactness(collection) {
  print('Filtering components by compactness...');
  statusLabel.setValue('Filtering components by compactness...');
  
  // Iterate through component lists for each image
  var filtered = collection.map(function(fc) {
    fc = ee.FeatureCollection(fc);
    
    // Evaluate compactness >>>>> (MORE COMMMENTS HERE) <<<<<
    var withCompactness = fc.map(function(f) {
      var simplified = f.geometry().simplify({maxError: 5});
      var area = simplified.area({maxError: 1});
      var perimeter = simplified.perimeter({maxError: 1});
      var compactness = ee.Number(4).multiply(Math.PI).multiply(area)
        .divide(perimeter.pow(2));
      return f.set('compactness', compactness);
    });
    
    // Return only components that exceed minimum compactness threshold
    return withCompactness.filter(ee.Filter.gt('compactness', minCompactness));
  });
  
  // Return filtered list of components for each image
  print('Compactness filtering complete.');
  statusLabel.setValue('Compactness filtering complete.');
  return filtered;
}

// ----- Component Statistics -----

// Calculate the area of each component for each image and append to metadata
function computeComponentArea(featureCollections) {
  print('Computing component areas...');
  statusLabel.setValue('Computing component areas...');
  
  // Iterate through feature collection containing component groups for all images
  var withArea = featureCollections.map(function(fc) {
    
    // Get feature collection of components for this image
    fc = ee.FeatureCollection(fc);
    
    // For each component in collection of this image...
    return fc.map(function(f) {
      
      // Calculate the area of the polygon
      var area = f.geometry().area({maxError: 1});
      
      // Append to metadata
      return f.set('area_m2', area);
      
    // Filter for any polygons less than minimum defined iceberg area
    }).filter(ee.Filter.gt('area_m2', minimumPixelCount * 100));
  });
  
  // Return collection of component groups for all images
  print('Component areas computed.');
  statusLabel.setValue('Component areas computed.');
  return withArea;
}

// Compute the centroid lon/lat for each component for each image and append to metadata
function computeComponentCentroids(featureCollections) {
  print('Computing component centroids...');
  statusLabel.setValue('Computing component centroids...');
  
  // Iterate through feature collection containing component groups for all images
  var withCentroids = featureCollections.map(function(fc) {
    
    // Get feature collection of components for this image
    fc = ee.FeatureCollection(fc);
    
    // For each component in collection of this image...
    return fc.map(function(f) {
      
      // Find centroid
      var centroid = f.geometry().centroid({maxError: 1});
      
      // Get coordinates
      var coords = centroid.coordinates();
      
      // Append centroid lat/lon to metadata
      return f.set({
        'centroid_lon': coords.get(0),
        'centroid_lat': coords.get(1)
      });
    });
  });
  
  // Return collection of component groups for all images
  print('Component centroids computed.');
  statusLabel.setValue('Component centroids computed.');
  return withCentroids;
}

// ----- Visualization -----

// Ad a legend to the UI
function addAreaLegend(areaMin, areaMax, areaPalette) {
  
  // Initialize legend object
  var legend = ui.Panel({
    style: {
      position: 'bottom-right',
      padding: '8px 15px'
    }
  });

  // Add title to legend
  legend.add(ui.Label({
    value: 'Component Area (m²)',
    style: {fontWeight: 'bold', fontSize: '14px', margin: '0 0 6px 0'}
  }));

  // Get number of discrete colors in palette
  var numSteps = areaPalette.length;
  
  // Iterate through palette...
  for (var i = 0; i < numSteps; i++) {
    
    // Calculate the value for each color based on range of possible areas
    var value = areaMin + (areaMax - areaMin) * (i / (numSteps - 1));
    
    // Round the value and append the unit
    var label = Math.round(value).toLocaleString() + ' m²';
    
    // Create the row for color currently being processed
    var row = ui.Panel({
      widgets: [
        
        // Stylization of box
        ui.Label({
          style: {
            backgroundColor: '#' + areaPalette[i],
            padding: '8px 16px',
            margin: '0 8px 2px 0',
            border: '1px solid #999'
          }
        }),
        
        // Stylization of label
        ui.Label({
          value: label,
          style: {margin: '2px 0 0 0', fontSize: '11px'}
        })
      ],
      
      // Layout of label/box
      layout: ui.Panel.Layout.Flow('horizontal')
    });

    // Add current row to legend
    legend.add(row);
  }
  
  // Add a second title for position
  legend.add(ui.Label({
    value: 'Component Position',
    style: {fontWeight: 'bold', fontSize: '14px', margin: '6px 0 0 0'}
  }));
  
  // Generate centroid symbology
  var centroidRow = ui.Panel({
    widgets: [
      ui.Label({
        value: '●',
        style: {
          color: '#FF0000',
          fontSize: '16px',
          padding: '0 12px',
          margin: '0 8px 2px 0'
        }
      }),
      ui.Label({
        value: 'Centroid',
        style: {margin: '2px 0 0 0', fontSize: '11px'}
      })
    ],
    layout: ui.Panel.Layout.Flow('horizontal')
  });
  
  // Add the centroid symbology row to the legend
  legend.add(centroidRow);
    
    // Add legend to map
    map.add(legend);
  }

// Generate a histogram of component areas for each image, and a cumulative histogram across all images
function createAreaHistograms(featureCollections, dates, areaMin, areaMax) {
  print('Generating area histograms...');
  statusLabel.setValue('Generating area histograms...');
  
  // Chart stylization
  var chartStyle = {
    backgroundColor: '#333333',
    titleTextStyle: {color: '#CCCCCC'},
    hAxis: {
      title: 'Area (m²)',
      viewWindow: {min: 0, max: areaMax},
      textStyle: {color: '#CCCCCC'},
      titleTextStyle: {color: '#CCCCCC'},
      gridlines: {color: '#FFFFFF'},
      baselineColor: '#FFFFFF'
    },
    vAxis: {
      title: 'Count',
      textStyle: {color: '#CCCCCC'},
      titleTextStyle: {color: '#CCCCCC'},
      gridlines: {color: '#FFFFFF'},
      baselineColor: '#FFFFFF'
    },
    legend: {position: 'none'},
    colors: ['97C1E6']
  };
  
  // For each collection of all components from each image...
  dates.forEach(function(timestamp, i) {
    
    // Get date string
    var dateStr = new Date(timestamp).toISOString().slice(0, 10);
    
    // Get collection all components
    var fc = ee.FeatureCollection(featureCollections.get(i));
    
    // For each component...
    fc.size().evaluate(function(count){
      
      // Create title
      chartStyle.title = 'Component Areas - ' + dateStr;
      
      // Generat the histogram
      var chart = ui.Chart.feature.histogram(fc, 'area_m2', numBins)
        .setOptions(chartStyle);
      
      // Print to console
      print(chart);
    });
  });
  
  // Flatten feature collections so that all components are now in one collection
  var allComponents = ee.FeatureCollection(featureCollections).flatten();
  
  // For each component...
  allComponents.size().evaluate(function(count) {
    
    // Create title
    chartStyle.title = 'Component Areas - All Dates';
    
    // Generate histogram
    var cumulativeChart = ui.Chart.feature.histogram(allComponents, 'area_m2', numBins)
      .setOptions(chartStyle);
    
    // Print histogram to console
    print(cumulativeChart);
  });
}

// Generate histograms in the App UI
function uiAreaHistograms(featureCollections, dates, areaMin, areaMax) {
  print('Generating component area histograms...');
  
  // Clear any charts from a previous run
  chartContainer.clear();

  // Stylization of historgram
  var chartStyle = {
    backgroundColor: '#333333',
    titleTextStyle: {color: '#CCCCCC'},
    hAxis: {
      title: 'Area (m²)',
      viewWindow: {min: 0, max: areaMax},
      textStyle: {color: '#CCCCCC'},
      titleTextStyle: {color: '#CCCCCC'},
      gridlines: {color: '#FFFFFF'},
      baselineColor: '#FFFFFF'
    },
    vAxis: {
      title: 'Count',
      textStyle: {color: '#CCCCCC'},
      titleTextStyle: {color: '#CCCCCC'},
      gridlines: {color: '#FFFFFF'},
      baselineColor: '#FFFFFF'
    },
    legend: {position: 'none'},
    colors: ['97C1E6']
  };

  // For each date in list...
  dates.forEach(function(timestamp, i) {
    
    // Generate a date string
    var dateStr = new Date(timestamp).toISOString().slice(0, 10);
    
    // Get feature collection (of components)
    var fc = ee.FeatureCollection(featureCollections.get(i));

    // For each feature collectiion...
    fc.size().evaluate(function(count) {
      
      // Set style
      var style = JSON.parse(JSON.stringify(chartStyle));
      
      // Date the histogram
      style.title = 'Component Areas - ' + dateStr;
      
      // Initialize histogram
      var chart = ui.Chart.feature.histogram(fc, 'area_m2', numBins)
        .setOptions(style);

      // Add to chart panel
      chartContainer.add(chart);
    });
  });

  // Generate one last cumulative chart across all dates
  var allComponents = ee.FeatureCollection(featureCollections).flatten();
  allComponents.size().evaluate(function(count) {
    var style = JSON.parse(JSON.stringify(chartStyle));
    style.title = 'Component Areas - All Dates';
    var cumulativeChart = ui.Chart.feature.histogram(allComponents, 'area_m2', numBins)
      .setOptions(style);
    chartContainer.add(cumulativeChart);
  });
}

// Export CSV 
function exportComponentCSV(featureCollections, dates, areaMin, areaMax) {
  
  // Calculate bin width
  var binWidth = (areaMax - areaMin) / numBins;
  
  // Initialize list of feature collections (component groups per image) for iteration
  var fcList = ee.List(featureCollections);
  
  // Flatten for the cumulative areas across all dates column calculation
  var allFc = ee.FeatureCollection(fcList).flatten();
  
  // Convert client-side timestamps to server-side date strings
  var eeDates = ee.List(dates.map(function(t) {
    return new Date(t).toISOString().slice(0, 10);
  }));
  
  // Build one feature per bin
  var binFeatures = ee.List.sequence(0, numBins - 1).map(function(binIndex) {
    var binMin = ee.Number(areaMin).add(ee.Number(binIndex).multiply(binWidth));
    var binMax = binMin.add(binWidth);
    
    // Base properties bin range
    var props = ee.Dictionary({
      'area_bin_min_m2': binMin.round(),
      'area_bin_max_m2': binMax.round()
    });
    
    // Add a count column for each date
    var withDateCounts = ee.List.sequence(0, fcList.length().subtract(1))
      .iterate(function(i, acc) {
        var fc = ee.FeatureCollection(fcList.get(i));
        var dateStr = ee.String(eeDates.get(i));
        var count = fc.filter(
          ee.Filter.and(
            ee.Filter.gte('area_m2', binMin),
            ee.Filter.lt('area_m2', binMax)
          )
        ).size();
        return ee.Dictionary(acc).set(dateStr, count);
      }, props);
    
    // Add all-dates total column
    var totalCount = allFc.filter(
      ee.Filter.and(
        ee.Filter.gte('area_m2', binMin),
        ee.Filter.lt('area_m2', binMax)
      )
    ).size();
    
    return ee.Feature(null, ee.Dictionary(withDateCounts).set('all_dates', totalCount));
  });
  
  // Queue export task
  Export.table.toDrive({
    collection: ee.FeatureCollection(binFeatures),
    description: 'icePick_components',
    fileFormat: 'CSV'
  });
  
  statusLabel.setValue('CSV export queued — run the task in the Tasks tab.');
}

// ~~~~~ MAIN BODY ~~~~~
runButton.onClick(function() {
  
  // ----- Widget Variables -----
  
  // Clear previous session
  map.clear();
  
  // Region of Interest
  coords.lon = parseFloat(lonBox.getValue());
  coords.lat = parseFloat(latBox.getValue());
  bounds = boundsSlider.getValue()

  // Time Window
  timeWindow.startDate = startDateBox.getValue();
  timeWindow.endDate   = endDateBox.getValue();
  var dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(timeWindow.startDate) || !dateRegex.test(timeWindow.endDate)) {
    statusLabel.setValue('Dates must be in YYYY-MM-DD format.');
    return;
  }
  if (timeWindow.startDate >= timeWindow.endDate) {
    statusLabel.setValue('Start date must be before end date.');
    return;
  }
  
  // Satellite Parameters
  satParams.instrumentMode = instrumentModeSelect.getValue() === 'ANY' ? null : instrumentModeSelect.getValue();
  satParams.polarization = polarizationSelect.getValue();
  satParams.orbitPass = orbitPassSelect.getValue() === 'ANY' ? null : orbitPassSelect.getValue();
  
  // Land Mask
  maskThresh = maskThreshSlider.getValue();
  shrink = shrinkSlider.getValue();
  
  // Preprocessing
  medianParams.radius = medianRadiusSlider.getValue();
  medianParams.kernelType = kernelTypeSelect.getValue();
  medianParams.units = kernelUnitsSelect.getValue();
  
  // Connected component detection
  ampThresh = parseFloat(ampThreshBox.getValue());
  minimumPixelCount = minPixelSlider.getValue();
  maximumPixelCount = maxPixelSlider.getValue();
  searchSize = searchSizeSelect.getValue();
  connectedness = connectedSelect.getValue() === 'square' ? ee.Kernel.square(1) : ee.Kernel.plus(1);
  glcmSwitch = glcmCheckbox.getValue() ? 1 : 0;
  homogeneityThresh = homogeneitySlider.getValue();
  entropyThresh = entropySlider.getValue();
  glcmSize = glcmSizeSlider.getValue();
  morphSwitch = morphCheckbox.getValue() ? 1 : 0;
  morphPixels = morphPixelsSlider.getValue();
  
  // Post-processing
  compactnessSwitch = compactnessCheckbox.getValue() ? 1 : 0;
  minCompactness    = minCompactnessSlider.getValue();
    
  // ----- Dataset Preperation -----
  print('Loading datasets...');
  statusLabel.setValue('Loading datasets...');
  
  // Global surface water raster
  var JRC = ee.Image('JRC/GSW1_4/GlobalSurfaceWater');
  
  // Shoreline polygons from community catalog
  var mainlands = ee.FeatureCollection('projects/sat-io/open-datasets/shoreline/mainlands');
  var islands = ee.FeatureCollection('projects/sat-io/open-datasets/shoreline/big_islands');
  
  // Initialize area of interest geometry
  var POI = ee.Geometry.Point(coords.lon, coords.lat);
  var boundingBox = POI.buffer(bounds);
  
  // Filter based on region of interest and time window (only if contains full ROI)
  var S1 = ee.ImageCollection('COPERNICUS/S1_GRD')
    .filterDate(timeWindow.startDate, timeWindow.endDate)
    .filter(ee.Filter.contains({leftField: '.geo', rightValue: boundingBox}));
  
  // Exit if dataset cannot load or no images are found
  S1.size().evaluate(function(size, error) {
    if (error) {
      print('Error loading dataset:', error);
      statusLabel.setValue('Error loading dataset.');
      return;
    }
    if (size === 0) {
      print('No images found for region/time window.');
      statusLabel.setValue('No images found for region/time window.');
      return;
    }
    
    // Continue if dataset is successfully loaded and images are found
    print('Datasets successfully loaded. Images found:', size);
    statusLabel.setValue('Datasets successfully loaded. Images found: ' + size);
  
    // Filter collection based on satellite parameters
    var S1Filtered = filterSatParams(S1);
  
    // Exit if filter encounters an error or no images are found
    S1Filtered.size().evaluate(function(filteredSize, error) {
      if (error) {
        print('Error filtering dataset:', error);
        statusLabel.setValue('Error filtering dataset.');
        return;
      }
      if (filteredSize === 0) {
        print('No images found after filtering.');
        statusLabel.setValue('No images found after filtering.');
        return;
      }
      
      // Continue if images are found
      print('Dataset filtered. Images found:', filteredSize);
      statusLabel.setValue('Dataset filtered. Images found: ' + filteredSize);
      
      // Sort based on date (ascending order / oldest first) and isolate specified band
      var S1Sorted = S1Filtered.sort('system:time_start').select(satParams.polarization);
      
      // ----- Land Mask -----
      
      // Clip images to bounding box
      var S1Clipped = clipToBoundingBox(S1Sorted, boundingBox)
  
      // Convert vector to raster mask
      var landVector = ee.Image.constant(0).paint(mainlands, 1)
        .add(ee.Image.constant(0).paint(islands, 1))
        .gt(0)
        .clip(boundingBox);
  
      // Invert to get water
      var vectorWater = landVector.not();
  
      // From global surface water dataset, select pixels where water occurs "maskThresh" percentage of the time
      var surfaceWater = JRC.select('occurrence').gt(maskThresh).clip(boundingBox);
      
      // Apply a buffer to the mask
      var bufferedLandMask = surfaceWater
        .focal_min({
          radius: shrink,
          kernelType: 'circle',
          units: 'meters'});
      
      // Combine both masks for a detailed water edge but cleaner land mask
      var combinedMask = bufferedLandMask.and(vectorWater);
      
      // Apply mask to collection, returns masked image collection
      var masked = applyLandMask(S1Clipped, combinedMask, filteredSize);
      
      // ----- Preprocessing -----
      
      // Apply a median filter to reduce speckle but mantain bright edges
      var maskedSmoothed = applyMedianFilter(masked);
      
      // Add bands with texture properties (homogenous/inhomogenous) based on GLCM matrix
      var withTexture = addTextureBands(maskedSmoothed);
      
      // ----- Connected Component Detection -----
      
      // Identify connected components, returns masked imge collection
      var components = getConnectedComponents(withTexture, filteredSize);
      
      // ----- Post-Processing -----
      
      // Vectorize each labeled component and output as a feature collection
      var vectorized = vectorizeComponents(components, boundingBox);
      
      // Filter components by compactness
      if (compactnessSwitch == 1){
        var compact = filterByCompactness(vectorized);
      }
      else {
        var compact = vectorized 
      }
      
      // ----- Component Statistics -----
      
      // Specify minimum and maximum area based on component detection filter
      var areaMin = minimumPixelCount * 100;
      var areaMax = maximumPixelCount * 100;
      
      // Get area of each component (m^2)
      var withArea = computeComponentArea(compact);
      
      // Get position of centroid for each component (lat/lon)
      var withStats = computeComponentCentroids(withArea);
      
      // ----- Visualization -----
      
      print('Constructing map...')
      statusLabel.setValue('Constructing map...');
      
      // Center map on POI and set zoom
      map.centerObject(POI, zoomLevel);
      
      // Get a list of all image dates
      var dateList = S1Clipped.aggregate_array('system:time_start');
      dateList.evaluate(function(dates) {
        
        // Convert collections to lists for indexed mapping
        var imageList = S1Clipped.toList(dates.length);
        var textureList = withTexture.toList(dates.length);
        
        // Initialize components and processed image counters
        var totalComponents = 0;
        var imagesProcessed = 0;
        
        // Iterate through the date list
        dates.forEach(function(timestamp, i) {
          
          // Create a date string for layer naming
          var dateStr = new Date(timestamp).toISOString().slice(0, 10);
          
          // Map the specified band of the clipped Sentinel-1 Image
          map.addLayer(ee.Image(imageList.get(i)).select(satParams.polarization), {min: -25, max: 0}, dateStr + ' dB' );
          
          // Get the list of component polygons for current image
          var componentsFinal = ee.FeatureCollection(withStats.get(i));
          
          // Get number of components and print to console
          componentsFinal.size().evaluate(function(count){print('Components for ' + dateStr + ': ' + count);});
          
          // Stylize components for visualization (gradient from palette based on area)
          var styleComponents = componentsFinal.map(function(f) {
            
            // Get ara from metadata
            var area = ee.Number(f.get('area_m2'));
            
            // Normalize from based on full range of possible areas
            var normalized = area.subtract(areaMin)
              .divide(areaMax - areaMin)
              .clamp(0, 1);
              
            // Use normalized value to determine appropriate color from palette
            var colorIndex = normalized.multiply(areaPalette.length - 1).round().toInt();
            
            // Get color from palette
            var color = ee.List(areaPalette).get(colorIndex);
            
            // Fill with a semi-transparent version of the same color
            var fillColor = ee.String(color).cat('80');
            
            // Return the color and fill color for component
            return f.set('style', {color: color, fillColor: fillColor});
          }).style({styleProperty: 'style'});
          
          // Add stylized components to map
          map.addLayer(styleComponents, {}, dateStr + ' Components', true, 0.9);
          
          // For each component, create a point from the centroid lat/lon metadata
          var centroids = componentsFinal.map(function(f) {
            var point = ee.Geometry.Point([f.get('centroid_lon'), f.get('centroid_lat')]);
            return ee.Feature(point).copyProperties(f);
          });
        
          // Add centroids to map
          map.addLayer(centroids.style({
            color: 'FF0000',
            pointSize: 1,
            width: 1
          }), {}, dateStr + ' Centroids', true);
          
          // Add a layer of invisible non-styled components for label inspection
          map.addLayer(componentsFinal, {color: '00000000'}, dateStr + ' Component Info (Inspector Only)', false);
          
          // Map the GLCM entropy band
          map.addLayer(ee.Image(textureList.get(i)).select('entropy'),
            {min: 0, max: 6, palette: ['blue', 'green', 'yellow', 'red']},
            dateStr + ' Entropy', false);
            
          // Map the GLCM homogeneity band
          map.addLayer(ee.Image(textureList.get(i)).select('homogeneity'),
            {min: 0, max: 1, palette: ['red', 'yellow', 'green', 'blue']},
            dateStr + ' Homogeneity', false);
        });
        
        // Flatten the feature collection containing collections of components for each date
        var allComponents = ee.FeatureCollection(withStats).flatten();
        
        // Evaluate the number of components
        allComponents.size().evaluate(function(total) {
          
          // If there are none, issue warning to UI
          if (total === 0) {
            print('No components found across ' + dates.length + ' image(s). Try adjusting your location/thresholds.')
            statusLabel.setValue('No components found across ' + dates.length + ' image(s). Try adjusting your location/thresholds.');
          
            
          // If there are detected components...  
          } else {
            print('Analysis complete. ' + total + ' component(s) found across ' + dates.length + ' image(s).')
            statusLabel.setValue('Analysis complete. ' + total + ' component(s) found across ' + dates.length + ' image(s).');
            
            // Map analysis zone 
            var analysisZone = combinedMask.clip(boundingBox).eq(1).selfMask();
            map.addLayer(analysisZone, {palette: ['blue']}, 'Analysis Zone', true, 0.25);
            
            // Add legend to map
            addAreaLegend(areaMin, areaMax, areaPalette);
            
            // Add show histograms button
            resultsPanel.clear();
            resultsPanel.add(ui.Button({
              label: 'Show Component Area Histograms',
              onClick: function() {
                map.add(chartPanel);
                chartPanel.style().set('shown', true);
                createAreaHistograms(withStats, dates, areaMin, areaMax);
                uiAreaHistograms(withStats, dates, areaMin, areaMax);
              },
              style: {
                margin: '4px 0px 4px 0px',
                color: theme.runText,
                backgroundColor: theme.accentDark
              }
            }));
            
            // Show export CSV button
            resultsPanel.add(ui.Button({
            label: 'Export Component Area CSV',
            onClick: function() {
              exportComponentCSV(withStats, dates, areaMin, areaMax);
            },
            style: {
              margin: '0px 0px 4px 0px',
              color: theme.runText,
              backgroundColor: theme.accentDark
            }
          }));
          }
        });
      });
    });
  });
});
  
  
