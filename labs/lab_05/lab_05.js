// Initialize arrays containing L8 band names to select, and names they'll be converted to
var bands = ['SR_B2', 'SR_B3', 'SR_B4', 'SR_B5', 'SR_B6', 'SR_B7'];
var rename_bands = ['blue', 'green', 'red', 'nir', 'swir1', 'swir2'];

// Filter image and create a mosaic based on least land cover, select and rename bands
var nile_img = ee.Image(l8.filterBounds(nile_delta)
    .filterDate('2016-05-01', '2016-07-30')
    .sort('CLOUD_COVER_LAND',false)
    .mosaic())
    .select(bands, rename_bands);

// Add mosaic image to map
Map.addLayer(nile_img, {bands: ['swir2', 'swir1', 'red'], min:1000,max:[40000,44000,40000]}, 'nile 2016');

// Merge FeatureCollections for land cover points
// The Google help files for the merge() function reccomend to use this method, as opposed to calling merge() repeatedly
var collections = [open_water, vegetation, urban_developed, barren, river];
var training_pts = ee.FeatureCollection(collections);
var training_pts = training_pts.flatten();

// Calculate NDVI and NDWI and add them to our image bands
var ndvi = nile_img.normalizedDifference(['nir', 'red']).rename('ndvi');
var ndwi = nile_img.normalizedDifference(['green', 'nir']).rename('ndwi');
var nile_img_vars = nile_img.addBands(ndvi).addBands(ndwi);
var nile_img_vars = nile_img_vars.addBands(ee.Image.pixelLonLat());

// Extract values from training points
var input_img = nile_img_vars; // <-- what value goes here?
var training_pts_collection =  training_pts; // <-- what value goes here? 
var scale_value = 30; // <-- what is an appropriate spatial scale for your image sampling?
var training_extract = input_img.sampleRegions({ 
  collection: training_pts_collection, 
  scale: scale_value 
});

// print(training_extract);
// print(training_pts);

// Use reducer to get mean band values for each land cover type
function classMeanFeature(img, geom, label) {
  
  var stats = img.reduceRegion({
    reducer: ee.Reducer.mean(),
    geometry: geom,
    scale: 30,
  });
  
  var set_args = ee.Dictionary({
    landcover: label
  });
  
  return ee.Feature(null, stats).set(set_args);
}
var vegetation_means = classMeanFeature(nile_img_vars, vegetation, 'vegetation');
var water_means = classMeanFeature(nile_img_vars, open_water, 'open_water');
var urban_means = classMeanFeature(nile_img_vars, urban_developed, 'urban_developed');
var barren_means = classMeanFeature(nile_img_vars, barren, 'barren');
var river_means = classMeanFeature(nile_img_vars, river, 'river');

// Plot the mean NDVI value for each 
var lc_spec_vars = ui.Chart.feature.byProperty([water_means, vegetation_means, urban_means, barren_means, river_means], ['ndvi','ndwi'], 'landcover').setOptions({
      title: 'NDVI vs. NDWI',
      hAxis: {'title': 'bands'},
      vAxis: {'title': 'value'}});
      
print(lc_spec_vars)

// Train the classifier
var classifier = ee.Classifier.smileCart().train({
  features: training_extract, 
  classProperty: 'landcover', 
  inputProperties: ['blue', 'green', 'red', 'nir', 'swir1', 'swir2','ndvi','ndwi']
})

var classifier = ee.Classifier.smileCart().train({
  features: training_extract, 
  classProperty: 'landcover', 
  inputProperties: ['blue', 'green', 'red', 'nir', 'swir1', 'swir2','ndvi','ndwi']
})

// Visualize the output
var nile_classified = nile_img_vars.classify(classifier)

var palette = [
  '0000FF',  // open_water: blue
  '008000',  // vegetation: green
  'FF0000',  // urban: red
  'FFA500',  // barren: orange
  '87CEFA'   // river: light blue
];

Map.addLayer(nile_classified, {min: 0,max: 4,palette: palette}, 'Landcover Classification');

var riccellm = '' //<-- enter your ONID username here
Export.table.toDrive({
  collection:training_extract,
  description:riccellm+'_training_sites',
  folder: 'Geog481_581_lab',
  fileNamePrefix: 'File'+riccellm+'_training_sites',
  fileFormat:'CSV'
})

// Mask pixel groupings if they are not with in a threshold of continguous pixels
Map.centerObject(nile_delta, 11);
var classified_pixel_count = nile_classified.connectedPixelCount();
var pixelArea = ee.Image.pixelArea();
var classified_area = classified_pixel_count.multiply(pixelArea);
var mmu = 100000; // this represents a minimum mapping unit (MMU) in m^2
var mmu_mask = classified_area.gte(mmu);
var nile_classified_mmu = nile_classified.updateMask(mmu_mask);
Map.addLayer(nile_classified_mmu.randomVisualizer(),{}, 'nile_classified_mmu');

