// ESTABLISH STUDY AREA AND PERIOD
var yr = 2010; // 2010, 2013
var region = ee.Geometry.Rectangle(-89.5, 43.05, -89.3, 43.15)
Map.setCenter(-89.3875, 43.0869,12)

// LOAD REFERENCE AERIAL IMAGERY
var naip_filtered = ee.ImageCollection('USDA/NAIP/DOQQ')
      .filterBounds(region)
      .filterDate(yr+'-01-01', yr+'-12-31')
var naip_mosaic = ee.Image(naip_filtered.mosaic())
Map.addLayer(naip_mosaic, {bands:['R','G','B']}, yr+'_naip')

print(naip_filtered)

// LOAD LANDSAT TOA MOSAIC FOR CLASSIFICATION
var landsat_input= ee.Image('LANDSAT/LE7_TOA_1YEAR/'+yr)
var landsat_visParams = {
  bands: ['B4', 'B3', 'B2'],
  min: 0,
  max: 255
};
Map.addLayer(landsat_input,landsat_visParams,'landsat input')

function classify(image,num_clusters,num_px,max_iter,val_seed,img_scale){

  // MAKE A TRAINING DATASET FOR INPUT BELOW
  var training = image.sample({
    region: region,
    scale: img_scale,
    numPixels: num_px
  })

  // TRAIN THE CLASSIFIER BASED ON SAMPLED SITES
  var clusterer = ee.Clusterer.wekaKMeans({
    nClusters: num_clusters,
    maxIterations: max_iter,
    seed: val_seed
    }).train(training)
  
  // VIEW CLASSIFIED OUTPUT IMAGE
  var classified_image = image.cluster(clusterer).clip(region)
  return classified_image 
}

var input_nir = "B4"
var input_blue = "B1"

var landsat_41 = landsat_input.select(input_nir, input_blue);

// CLASSIFY THE IMAGE WITH K MEANS 
var result = classify(
landsat_41, // the input image
	15, // the number of clusters to create
  5000, // the number of pixels to sample
  50, // the max number of iterations to perform
  17, // a number that guides the random sampling
  30 // the image’s spatial resolution (in meters) 
)


// VISUALIZE THE CLUSTERS USING A RANDOM COLOR PALETTE
Map.addLayer(result.randomVisualizer(), {}, yr+'_clusters')

// CREATE AN OVERLAY IMAGE OF THE REGION BOUNDARY
Map.addLayer(ee.Image().paint(region, 0, 2), {}, 'region')

var nlcd_2011 = ee.ImageCollection('USGS/NLCD_RELEASES/2019_REL/NLCD').filter(ee.Filter.eq('system:index','2011')).first()
var nlcd_2011_lc = nlcd_2011.select('landcover').clip(region)
Map.addLayer(nlcd_2011_lc.randomVisualizer(),{},'NLCD 2011')

var histogram = ui.Chart.image.histogram(
  nlcd_2011_lc,
  region
  );
  
print(histogram)

var inset_region = ee.Geometry.Rectangle(-89.38768, 43.07002, -89.304, 43.05183)
Map.addLayer(ee.Image().paint(inset_region, 0, 2), {}, 'inset region')
Map.setCenter(-89.34005, 43.06174,14)

var histogram = ui.Chart.image.histogram(
  nlcd_2011_lc,
  region
  );
  
  
var result_cluster_values = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14] // 15 values from result image that correspond to 15 clusters
var nlcd_landcover_values = [82,81,24,23,11,41,41,81,43,23,11,21,24,43,43] // <-- which 15 values should go in this list?
var matched_nlcd_values = result.remap(result_cluster_values, nlcd_landcover_values)
Map.addLayer(matched_nlcd_values,{},'matched')

