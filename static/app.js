// Interactive map application for West Campus apartment listings using Leaflet and D3.js

class WestCampusMap {
    constructor() {
        this.initialCenter = [30.287, -97.742];
        this.initialZoom = 15;
        
        this.map = null;
        this.svg = null;
        this.g = null;
        
        this.apartments = [];
        this.westUniversityNeighborhood = null;
        this.utCampusNeighborhood = null;
        this.neighborhoodLayers = {};
        this.distanceOverlay = null;
        
        this.tooltip = null;
        
        this.utCampusCenter = [30.2862162,-97.7394];
        
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
        d3.select('#toggleDistanceBtn').on('click', () => this.toggleDistanceOverlay());
        
        d3.select('#distanceLegend').classed('hidden', true);
    }
    
    createMap() {
        this.map = L.map('map').setView(this.initialCenter, this.initialZoom);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(this.map);

        this.svg = d3.select(this.map.getPanes().overlayPane).append("svg");
        this.g = this.svg.append("g").attr("class", "leaflet-zoom-hide");

        this.map.on("viewreset", () => this.updateOverlay());
        this.map.on("zoomend", () => this.updateOverlay());
        this.map.on("moveend", () => this.updateOverlay());
        
        this.map.on('click', () => this.clearSelection());

        this.updateOverlay();
    }

    updateOverlay() {
        const bounds = this.map.getBounds();
        const topLeft = this.map.latLngToLayerPoint(bounds.getNorthWest());
        const bottomRight = this.map.latLngToLayerPoint(bounds.getSouthEast());

        this.svg.attr("width", bottomRight.x - topLeft.x)
            .attr("height", bottomRight.y - topLeft.y)
            .style("left", topLeft.x + "px")
            .style("top", topLeft.y + "px");

        this.g.attr("transform", `translate(${-topLeft.x}, ${-topLeft.y})`);

        this.renderApartments();
    }
    
    async getNeighborhoodData(neighname) {
        try {
            const response = await fetch(`https://data.austintexas.gov/resource/a7ap-j2yt.geojson?neighname=${encodeURIComponent(neighname)}`);
            
            if (response.ok) {
                return await response.json();
            } else {
                console.error(`Failed to fetch neighborhood data for ${neighname} from API`);
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
                    "coordinates": [[[]]]
                }
            }]
        };
    }
    
    async loadData() {
        try {
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
            this.renderMap();
        }
    }
    
    renderMap() {
        this.renderNeighborhoods();
        this.renderDistanceOverlay();
        this.renderApartments();
        this.updateInfoPanel();
    }
    
    renderDistanceOverlay() {
        if (this.distanceOverlay) {
            this.map.removeLayer(this.distanceOverlay);
        }
        
        const walkingDistances = [
            { minutes: 5, meters: 400, color: 'rgba(191, 87, 0, 0.20)' },
            { minutes: 10, meters: 800, color: 'rgba(191, 87, 0, 0.14)' },
            { minutes: 15, meters: 1200, color: 'rgba(191, 87, 0, 0.08)' }
        ];
        
        this.distanceOverlay = L.layerGroup();
        
        walkingDistances.reverse().forEach(distance => {
            const circle = L.circle(this.utCampusCenter, {
                radius: distance.meters,
                fillColor: distance.color.replace('rgba', 'rgb').replace(/,\s*[\d.]+\)/, ')'),
                fillOpacity: parseFloat(distance.color.match(/[\d.]+(?=\))/)[0]),
                color: 'rgba(191, 87, 0, 0.4)',
                weight: 2,
                opacity: 0.6,
                interactive: false
            });
            this.distanceOverlay.addLayer(circle);
        });
        
        // Don't add to map by default - let user toggle it on
    }
    
    toggleDistanceOverlay() {
        const legend = d3.select('#distanceLegend');
        const button = d3.select('#toggleDistanceBtn');
        
        if (this.map.hasLayer(this.distanceOverlay)) {
            this.map.removeLayer(this.distanceOverlay);
            legend.classed('hidden', true);
            button.text('Walking Distance');
        } else {
            this.distanceOverlay.addTo(this.map);
            legend.classed('hidden', false);
            button.text('Hide Distance');
        }
    }
    
    renderNeighborhoods() {
        Object.values(this.neighborhoodLayers).forEach(layer => {
            if (layer) this.map.removeLayer(layer);
        });
        
        if (this.westUniversityNeighborhood) {
            this.neighborhoodLayers.westUniversity = L.geoJSON(this.westUniversityNeighborhood, {
                style: {
                    fillColor: 'transparent',
                    weight: 3,
                    opacity: 0.8,
                    color: '#2C5AA0',
                    dashArray: '10, 5',
                    fillOpacity: 0
                },
                interactive: false
            }).addTo(this.map);
        }
        
        if (this.utCampusNeighborhood) {
            this.neighborhoodLayers.utCampus = L.geoJSON(this.utCampusNeighborhood, {
                style: {
                    fillColor: 'transparent',
                    weight: 3,
                    opacity: 0.9,
                    color: '#BF5700',
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

        const newMarkers = apartmentMarkers.enter()
            .append('g')
            .attr('class', 'apartment-marker');

        newMarkers.append('circle').attr('r', 8);
            
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
                event.stopPropagation();
                this.selectApartment(d);
            });

        apartmentMarkers.merge(newMarkers)
            .attr('transform', d => {
                const point = this.map.latLngToLayerPoint(new L.LatLng(d.lat, d.lon));
                return `translate(${point.x},${point.y})`;
            });
            
        apartmentMarkers.exit().remove();
    }
    
    selectApartment(apartment) {
        this.updateInfoPanel(apartment);
        
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
            const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedApartment.address)}`;
            
            infoPanel.html(`
                <div class="apartment-details">
                    <h3 class="apartment-name">${selectedApartment.name}</h3>
                    <p class="apartment-address">
                        <a href="${googleMapsUrl}" target="_blank" class="address-link">
                            ${selectedApartment.address}
                        </a>
                    </p>
                    
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

        const mapContainer = d3.select('.map-container').node();
        const containerRect = mapContainer.getBoundingClientRect();

        const relativeX = event.pageX - containerRect.left - window.scrollX;
        const relativeY = event.pageY - containerRect.top - window.scrollY;

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