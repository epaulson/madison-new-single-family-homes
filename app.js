var map = L.map('map').setView([43.0722, -89.4008], 11);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

var veridianLayer, nonVeridianLayer;
var veridianMarkers = L.markerClusterGroup({
    disableClusteringAtZoom: 14,
    maxClusterRadius: 30,
    spiderfyOnMaxZoom: false,
    iconCreateFunction: function(cluster) {
        var childCount = cluster.getChildCount();
        var radius = Math.max(9, (7 * (Math.log(childCount))));
        return L.divIcon({ html: '<b>' + childCount + '</b>', className: 'marker-cluster-veridian', iconSize: L.point(radius, radius) });
    }
});
var nonVeridianMarkers = L.markerClusterGroup({
    disableClusteringAtZoom: 14,
    maxClusterRadius: 30,
    spiderfyOnMaxZoom: false,
    iconCreateFunction: function(cluster) {
        var childCount = cluster.getChildCount();
        var radius = Math.max(20, (7 * (Math.log(childCount))));
        return L.divIcon({ html: '<b>' + childCount + '</b>', className: 'marker-cluster-nonveridian', iconSize: L.point(radius, radius) });
    }
});

// Helper - from https://stackoverflow.com/questions/31790344/determine-if-a-point-reside-inside-a-leaflet-polygon
function isMarkerInsidePolygon(marker, poly) {
    var polyPoints = poly.getLatLngs()[0];       
    var x = marker.getLatLng().lat, y = marker.getLatLng().lng;

    var inside = false;
    for (var i = 0, j = polyPoints.length - 1; i < polyPoints.length; j = i++) {
        var xi = polyPoints[i].lat, yi = polyPoints[i].lng;
        var xj = polyPoints[j].lat, yj = polyPoints[j].lng;

        var intersect = ((yi > y) != (yj > y))
            && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }

    return inside;
};

// Global variable to keep track of the selected markers
var selectedMarkers = [];
var lookupTable = {};
var lockSelection = true;

// Function to reset the style of all markers
function resetMarkerStyles() {
    selectedMarkers.forEach(function(marker) {
        var properties = marker.feature.properties;
        if (properties.veridian === true) {
            marker.setStyle({ color: 'red', weight: 1 });
        } else {
            marker.setStyle({ color: 'blue', weight: 1 }); // Reset to default color
        }
    });
    selectedMarkers = [];
}

// Function to update the infobox
function updateInfobox(content) {
    // Replace this with your actual infobox update code
    if (content === '') {
        document.getElementById('infobox').innerHTML = '<p>Zoom in and click on a marker to see information about that property. If you click on multiple markers, you\'ll see the most common sellers across the different selected properties. Red markers are Veridian Homes, blue markers are all other developers and individuals. <i>Scroll to the bottom for more hints on usage</i></p>';
        return;
    }
    document.getElementById('infobox').innerHTML = content;
}

function createParcelHtml(marker) {
    var properties = marker.feature.properties;

    var content = '<h2>Property Details</h2>' +
        '<table>' +
        '<tr><td>Parcel</td><td>' + '<a href=https://www.cityofmadison.com/assessor/property/propertydata.cfm?ParcelN=0' + properties.Parcel +' target="_blank">' + properties.Parcel + '</a>' + '</td></tr>' +
        '<tr><td>Address: </td><td>' + properties.Address + '</td></tr>' +
        '<tr><td>Year Built: </td><td>' + properties.YearBuilt + '</td></tr>' +
        '<tr><td>Style: </td><td>' + properties.HomeStyle + '</td></tr>' +
        '<tr><td>Bedrooms: </td><td>' + properties.Bedrooms + '</td></tr>' +
        '<tr><td>Living Area: </td><td>' + properties.TotalLivingArea + '</td></tr>' +
        '<tr><td>Lot Size: </td><td>' + properties.LotSize + '</td></tr>' +
        '<tr><td>Veridian?: </td><td>' + properties.veridian + '</td></tr>' +
        // Add the rest of the properties here...
        '</table>';
    return content;
}

function findMostCommonSeller() {
    var sellers = {};
    var totalSelected = selectedMarkers.length;

    selectedMarkers.forEach(function(marker) {
        var parcel = marker.feature.properties.Parcel;
        var sales = lookupTable[parcel];

        if (sales) {
            sales.forEach(function(sale) {
                if (!sellers[sale.seller]) {
                    sellers[sale.seller] = 0;
                }
                sellers[sale.seller]++;
            });
        }
    });

    var sortedSellers = Object.entries(sellers).sort(function(a, b) {
        return b[1] - a[1];
    });

    var topSellers = sortedSellers.filter(function(seller) {
        return seller[1] > 1;
    });

    if (topSellers.length === 0) {
        return '<h4>There are no common sellers in the selected properties</h4>';
    }
    
    topSellers = topSellers.slice(0, 3);

    var html = '<h4>Most Common Sellers across selected parcels</h4><table><tr><th>Seller</th><th>Count</th><th>Percentage</th></tr>';
    topSellers.forEach(function(seller) {
        var percentage = ((seller[1] / totalSelected) * 100).toFixed(2);
        html += '<tr><td>' + seller[0] + '</td><td>' + seller[1] + '</td><td>' + percentage + '%</td></tr>';
    });
    html += '</table>';
    html += '<i>Total Selected Markers: ' + totalSelected + '</i>';

    return html;
}

// Load and plot the 'veridian' and 'nonveridian' GeoJSON data
Promise.all([
    fetch('madison_single_family_homes_veridian.geojson')
        .then(response => response.json())
        .then(data => {
            veridianLayer = L.geoJSON(data, {
                pointToLayer: function (feature, latlng) {
                    return L.circleMarker(latlng, {
                        radius: 4,
                        fillColor: "red",
                        color: "red",
                        weight: 1,
                        opacity: 1,
                        fillOpacity: 0.8
                    });
                }
            });
            veridianMarkers.addLayer(veridianLayer);
        }),
    fetch('madison_single_family_homes_nonveridian.geojson')
        .then(response => response.json())
        .then(data => {
            nonVeridianLayer = L.geoJSON(data, {
                pointToLayer: function (feature, latlng) {
                    return L.circleMarker(latlng, {
                        radius: 4,
                        fillColor: "blue",
                        color: "blue",
                        weight: 1,
                        opacity: 1,
                        fillOpacity: 0.8
                    });
                }
            });
            nonVeridianMarkers.addLayer(nonVeridianLayer);
        }),
        
    fetch('minimal_sales_data.csv')
    .then(response => response.text())
    .then(data => {
        var parsedData = Papa.parse(data, {
            header: true,
            dynamicTyping: true,
            transformHeader: header =>
                header.trim() // Remove any leading/trailing whitespace
        }).data;
        // Create a lookup table

        parsedData.forEach(row => {
            if (!lookupTable[row.ParcelNumber]) {
                lookupTable[row.ParcelNumber] = [];
            }
            var sale = {
                date: row.SaleDate,
                seller: row.FullSeller,
                purchaser: row.FullPurchaser
            };
            lookupTable[row.ParcelNumber].push(sale);
        });
    })

]).then(() => {
    var group = new L.featureGroup([veridianMarkers, nonVeridianMarkers]);
    map.fitBounds(group.getBounds());

    var overlayLayers = {
        "Veridian": veridianMarkers,
        "Non-Veridian": nonVeridianMarkers,
        "Cluster": L.layerGroup() // This is a dummy layer
    };

    // Add the layers to the map by default
    // not sure we need the Cluster overlay anymore
    map.addLayer(veridianMarkers);
    map.addLayer(nonVeridianMarkers);
    map.addLayer(overlayLayers["Cluster"]);

    // Add event listeners for the checkboxes and the button
    document.getElementById('clustering').addEventListener('change', function() {
        if (this.checked) {
           veridianMarkers.enableClustering();
           nonVeridianMarkers.enableClustering();
        } else {
          veridianMarkers.disableClustering();
          nonVeridianMarkers.disableClustering();
        }
    });

    document.getElementById('lock-selection').addEventListener('change', function() {
        lockSelection = this.checked;
    });
    
    document.getElementById('clear-selection').addEventListener('click', function() {
        resetMarkerStyles();
        updateInfobox('');
    });
    
    // Add click event listener to each marker
    veridianMarkers.eachLayer(function (marker) {
        marker.on('click', function (e) {
            var index = selectedMarkers.indexOf(marker);
            if (index === -1) {
                selectedMarkers.push(marker);
                marker.setStyle({ color: 'yellow', weight: 3 }); // Highlight the marker
            } else {
                selectedMarkers.splice(index, 1);
                marker.setStyle({ color: 'red', weight: 1 }); // Reset the marker style
            }
            if (selectedMarkers.length > 1) {
                updateInfobox(findMostCommonSeller());
            } else if (selectedMarkers.length === 1) {
                updateInfobox(createParcelHtml(marker));
            } else {
                updateInfobox('');
            }
        });
    });

    nonVeridianMarkers.eachLayer(function (marker) {
        marker.on('click', function (e) {
            var index = selectedMarkers.indexOf(marker);
            if (index === -1) {
                selectedMarkers.push(marker);
                marker.setStyle({ color: 'yellow', weight: 3 }); // Highlight the marker
            } else {
                selectedMarkers.splice(index, 1);
                marker.setStyle({ color: 'blue', weight: 1 }); // Reset the marker style
            }
            if (selectedMarkers.length > 1) {
                updateInfobox(findMostCommonSeller());
            } else if (selectedMarkers.length === 1) {
                updateInfobox(createParcelHtml(marker));
            } else {
                updateInfobox('');
            }
            
        });
    });
    // Add click event listener to the map
    map.on('click', function (e) {
        if (e.originalEvent.target.tagName !== 'path' && !lockSelection) {
            resetMarkerStyles();
            updateInfobox('');
        }
    });
    
    // Add boxzoomend event listener to the map
    map.on('boxzoomend', function (e) {
        // Unselect any selected markers
        resetMarkerStyles();
        selectedMarkers = [];

        // Select all markers that fall into the bounds
        veridianMarkers.eachLayer(function (marker) {
            if (e.boxZoomBounds.contains(marker.getLatLng())) {
                selectedMarkers.push(marker);
                marker.setStyle({ color: 'yellow', weight: 3 }); // Highlight the marker
            }
        });

        nonVeridianMarkers.eachLayer(function (marker) {
            if (e.boxZoomBounds.contains(marker.getLatLng())) {
                selectedMarkers.push(marker);
                marker.setStyle({ color: 'yellow', weight: 3 }); // Highlight the marker
            }
        });

        // Update the infobox
        if (selectedMarkers.length > 1) {
            updateInfobox(findMostCommonSeller());
        } else if (selectedMarkers.length === 1) {
            updateInfobox(createParcelHtml(selectedMarkers[0]));
        } else {
            updateInfobox('');
        }
    });

    function markerRadius(zoomLevel) {
        if (zoomLevel < 15) {
            return 4;
        } else if (zoomLevel < 17) {
            return 6;
        } else {
            return 8;
        }
    }

    map.on('zoomend', function() {

        var zoomLevel = map.getZoom();
        var newRadius = markerRadius(zoomLevel);
        
        veridianMarkers.eachLayer(function (marker) {
          marker.setRadius(newRadius);
        });

        nonVeridianMarkers.eachLayer(function (marker) {
          marker.setRadius(newRadius);
        })
      });

    const areaSelection = new window.leafletAreaSelection.DrawAreaSelection({
        onPolygonDblClick: (polygon, control, ev) => {

            resetMarkerStyles();
            selectedMarkers = [];

            // Select all markers that fall into the bounds
            veridianMarkers.eachLayer(function (marker) {
                if (isMarkerInsidePolygon(marker, polygon)) {
                    selectedMarkers.push(marker);
                    marker.setStyle({ color: 'yellow', weight: 3 }); // Highlight the marker
                }
            });

            nonVeridianMarkers.eachLayer(function (marker) {
                if (isMarkerInsidePolygon(marker, polygon)) {
                    selectedMarkers.push(marker);
                    marker.setStyle({ color: 'yellow', weight: 3 }); // Highlight the marker
                }
            });

            // Update the infobox
            if (selectedMarkers.length > 1) {
                updateInfobox(findMostCommonSeller());
            } else if (selectedMarkers.length === 1) {
                updateInfobox(createParcelHtml(selectedMarkers[0]));
            } else {
                updateInfobox('');
            }

            control.deactivate();
        },
    }
    );
    map.addControl(areaSelection);
});
