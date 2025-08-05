// passion_proj/static/app.js
// West Campus Apartments - Interactive Map Application
// Built with Leaflet and D3.js v7

class WestCampusMap {
    constructor() {
        // Map configuration
        this.initialCenter = [30.287, -97.742]; // Centered on West Campus
        this.initialZoom = 15;
        
        // Leaflet & D3 components
        this.map = null;
        this.svg = null;
        this.g = null; // Group for D3 elements
        
        // Data storage
        this.apartments = [];
        this.westUniversityNeighborhood = null;
        this.utCampusNeighborhood = null;
        this.neighborhoodLayers = {};
        
        // UI elements
        this.tooltip = null;
        
        // Initialize the application
        this.init();
    }
    
    init() {
        this.setupUI();
        this.createMap();
        this.loadData();
    }
    
    setupUI() {
        this.tooltip = d3.select('#tooltip');
        d3.select('#resetViewBtn').on('click', () => this.resetView());
    }
    
    createMap() {
        // 1. Initialize Leaflet Map
        this.map = L.map('map').setView(this.initialCenter, this.initialZoom);

        // 2. Add a Tile Layer (the base map)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(this.map);

        // 3. Add an SVG overlay for D3
        this.svg = d3.select(this.map.getPanes().overlayPane).append("svg");
        this.g = this.svg.append("g").attr("class", "leaflet-zoom-hide");

        // 4. Sync D3 overlay with Leaflet's zoom/pan
        this.map.on("viewreset", () => this.updateOverlay());
        this.map.on("zoomend", () => this.updateOverlay());
        this.map.on("moveend", () => this.updateOverlay());
        
        // 5. Add map click listener to clear selection
        this.map.on('click', () => this.clearSelection());

        this.updateOverlay(); // Initial positioning
    }

    // This function repositions the SVG overlay and its contents when the map moves
    updateOverlay() {
        // Get the current map bounds from Leaflet
        const bounds = this.map.getBounds();
        const topLeft = this.map.latLngToLayerPoint(bounds.getNorthWest());
        const bottomRight = this.map.latLngToLayerPoint(bounds.getSouthEast());

        // Set the SVG's position and size to match the map's viewport
        this.svg.attr("width", bottomRight.x - topLeft.x)
            .attr("height", bottomRight.y - topLeft.y)
            .style("left", topLeft.x + "px")
            .style("top", topLeft.y + "px");

        // Reposition the D3 group element
        this.g.attr("transform", `translate(${-topLeft.x}, ${-topLeft.y})`);

        // Reposition apartment markers
        this.renderApartments();
    }
    
    async getNeighborhoodData(neighname) {
        try {
            // Fetch neighborhood data from Austin's Open Data Portal
            const response = await fetch(`https://data.austintexas.gov/resource/a7ap-j2yt.geojson?neighname=${encodeURIComponent(neighname)}`);
            
            if (response.ok) {
                return await response.json();
            } else {
                console.error(`Failed to fetch neighborhood data for ${neighname} from API`);
                // Return fallback data if API request fails
                return this.getFallbackNeighborhoodData(neighname);
            }
        } catch (error) {
            console.error(`Error fetching neighborhood data for ${neighname}:`, error);
            return this.getFallbackNeighborhoodData(neighname);
        }
    }
    
    getFallbackNeighborhoodData(neighname) {
        return {
            "type": "FeatureCollection",
            "features": [{
                "type": "Feature",
                "properties": { "neighname": neighname },
                "geometry": {
                    "type": "MultiPolygon",
                    "coordinates": [[[]]] // Empty coordinates as fallback
                }
            }]
        };
    }
    
    async loadData() {
        try {
            // Load apartment data and both neighborhood data in parallel
            const [apartmentsResponse, westUniversityData, utCampusData] = await Promise.all([
                fetch('/api/apartments'),
                this.getNeighborhoodData('WEST UNIVERSITY'),
                this.getNeighborhoodData('UT')
            ]);
            
            if (!apartmentsResponse.ok) {
                throw new Error(`HTTP error! status: ${apartmentsResponse.status}`);
            }
            
            this.apartments = await apartmentsResponse.json();
            this.westUniversityNeighborhood = westUniversityData;
            this.utCampusNeighborhood = utCampusData;
            
            this.renderMap();
        } catch (error) {
            console.error('Error loading data:', error);
            // Still try to render the map even if some data failed to load
            this.renderMap();
        }
    }
    
    renderMap() {
        this.renderNeighborhoods();
        this.renderApartments();
        this.updateInfoPanel();
    }
    
    renderNeighborhoods() {
        // Clear existing neighborhood layers
        Object.values(this.neighborhoodLayers).forEach(layer => {
            if (layer) this.map.removeLayer(layer);
        });
        
        // Render West University neighborhood with blue dashed outline
        if (this.westUniversityNeighborhood) {
            this.neighborhoodLayers.westUniversity = L.geoJSON(this.westUniversityNeighborhood, {
                style: {
                    fillColor: 'transparent',
                    weight: 3,
                    opacity: 0.8,
                    color: '#2C5AA0', // Blue color for West University
                    dashArray: '10, 5',
                    fillOpacity: 0
                },
                interactive: false
            }).addTo(this.map);
        }
        
        // Render UT Campus with burnt orange solid outline
        if (this.utCampusNeighborhood) {
            this.neighborhoodLayers.utCampus = L.geoJSON(this.utCampusNeighborhood, {
                style: {
                    fillColor: 'transparent',
                    weight: 3,                 // Slightly thicker line for UT campus
                    opacity: 0.9,
                    color: '#BF5700',          // UT Burnt Orange
                    dashArray: '10, 5',           
                    fillOpacity: 0
                },
                interactive: false
            }).addTo(this.map);
        }
    }
    
    renderApartments() {
        if (!this.apartments || this.apartments.length === 0) return;

        const apartmentMarkers = this.g.selectAll('.apartment-marker')
            .data(this.apartments, d => d.name);

        // Enter selection
        const newMarkers = apartmentMarkers.enter()
            .append('g')
            .attr('class', 'apartment-marker');

        newMarkers.append('circle').attr('r', 8);
            
        // Add interaction handlers
        newMarkers.on('mouseover', (event, d) => {
                this.showTooltip(event, {
                    title: d.name,
                    info: `$${d.price_per_person}/month`,
                    photo: d.photo
                });
            })
            .on('mouseout', () => {
                this.hideTooltip();
            })
            .on('click', (event, d) => {
                event.stopPropagation(); // Prevent map click from firing
                this.selectApartment(d);
            });

        // Update selection (for repositioning on pan/zoom)
        apartmentMarkers.merge(newMarkers)
            .attr('transform', d => {
                const point = this.map.latLngToLayerPoint(new L.LatLng(d.lat, d.lon));
                return `translate(${point.x},${point.y})`;
            });
            
        // Exit selection
        apartmentMarkers.exit().remove();
    }
    
    selectApartment(apartment) {
        this.updateInfoPanel(apartment);
        
        // Use a 'selected' class to handle styling via CSS
        this.g.selectAll('.apartment-marker').classed('selected', false);
        this.g.selectAll('.apartment-marker')
            .filter(d => d.name === apartment.name)
            .classed('selected', true);
    }
    
    clearSelection() {
        this.g.selectAll('.apartment-marker').classed('selected', false);
        this.updateInfoPanel(null);
    }
    
    updateInfoPanel(selectedApartment = null) {
        const infoPanel = d3.select('#infoPanelContent');
        if (infoPanel.empty()) return;

        if (selectedApartment) {
            infoPanel.html(`
                <div class="apartment-details">
                    <h3 class="apartment-name">${selectedApartment.name}</h3>
                    <p class="apartment-address">${selectedApartment.address}</p>
                    
                    ${selectedApartment.photo ? `
                    <div class="apartment-image">
                        <img src="/static/images/${selectedApartment.photo}" alt="${selectedApartment.name}" />
                    </div>` : ''}
                    
                    <div class="price-section">
                        <p class="price-label">Price Per Person</p>
                        <h4 class="price-value">$${selectedApartment.price_per_person}/month</h4>
                    </div>
                    <div class="apartment-notes">
                        <p>${selectedApartment.notes}</p>
                    </div>
                    ${selectedApartment.website ? `
                    <div class="apartment-website">
                        <a href="${selectedApartment.website}" target="_blank" class="btn btn--primary btn--full-width">
                            Visit Website
                        </a>
                    </div>
                    ` : ''}
                </div>
            `);
        } else {
            infoPanel.html(`
                <div class="empty-state">
                    <div class="empty-state-icon">🏢</div>
                    <h3>Select an apartment</h3>
                    <p>Click on any marker on the map to view detailed information.</p>
                </div>
            `);
        }
    }
    
    showTooltip(event, data) {
        // Set content first to allow for measurement
        const hasPhoto = data.photo ? true : false;
        
        this.tooltip
            .classed('hidden', false)
            .html(`
                <div class="tooltip-content">
                    ${hasPhoto ? `
                    <div class="tooltip-image">
                        <img src="/static/images/${data.photo}" alt="${data.title}" />
                    </div>` : ''}
                    <h4 class="tooltip-title">${data.title}</h4>
                    <p class="tooltip-price">${data.info}</p>
                </div>
            `);
            
        const tooltipNode = this.tooltip.node();
        const tooltipWidth = tooltipNode.offsetWidth;
        const tooltipHeight = tooltipNode.offsetHeight;

        // The tooltip's position is absolute *relative to the map-container*.
        // We need to get the mouse position relative to that container.
        const mapContainer = d3.select('.map-container').node();
        const containerRect = mapContainer.getBoundingClientRect();

        const relativeX = event.pageX - containerRect.left - window.scrollX;
        const relativeY = event.pageY - containerRect.top - window.scrollY;

        // Position tooltip centered above the cursor, with a 12px gap
        const xPosition = relativeX - (tooltipWidth / 2);
        const yPosition = relativeY - tooltipHeight - 12;

        this.tooltip.style('left', `${xPosition}px`).style('top', `${yPosition}px`);
    }
    
    hideTooltip() {
        this.tooltip.classed('hidden', true);
    }
    
    resetView() {
        this.map.setView(this.initialCenter, this.initialZoom);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (typeof L === 'undefined' || typeof d3 === 'undefined') {
        console.error('Leaflet or D3.js is not loaded!');
        return;
    }
    window.westCampusMap = new WestCampusMap();
});