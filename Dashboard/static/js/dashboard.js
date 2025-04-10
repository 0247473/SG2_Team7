/**
 * Manufacturing Facility Dashboard
 * 
 * This script manages data loading, processing, and visualization 
 * for the manufacturing facility dashboard.
 */

// Global state
const state = {
    timeRange: 'month',
    wsMetric: 'downtime',
    selectedWorkstation: 1,
    productionView: 'production',
    data: {
        daily: null,
        workstation: null,
        plant: null,
        product: null,
        kpi: null
    }
};

// Color scales
const colorScales = {
    workstations: d3.scaleOrdinal()
        .domain([1, 2, 3, 4, 5, 6])
        .range(d3.schemeSet1),
    status: d3.scaleOrdinal()
        .domain(['active', 'waiting', 'downtime'])
        .range(['#28a745', '#ffc107', '#dc3545']),
    products: d3.scaleOrdinal()
        .domain(['Type A', 'Type B', 'Type C'])
        .range(['#4e79a7', '#f28e2c', '#e15759'])
};

// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
    console.log('Dashboard initialized');
    setupEventListeners();
    loadDashboardData();
});

// Setup event listeners for controls
function setupEventListeners() {
    // Time range selector
    document.getElementById('timeRangeSelector').addEventListener('change', (e) => {
        state.timeRange = e.target.value;
        updateDashboard();
    });
    
    // Workstation metric selector
    document.getElementById('wsMetricSelector').addEventListener('change', (e) => {
        state.wsMetric = e.target.value;
        updateWorkstationPerformance();
    });
    
    // Workstation selector for detailed view
    document.getElementById('wsSelector').addEventListener('change', (e) => {
        state.selectedWorkstation = parseInt(e.target.value);
        updateWorkstationDetails();
    });
    
    // Production chart view toggler
    const productionViewButtons = document.querySelectorAll('.card-header .btn-group button');
    productionViewButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            productionViewButtons.forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            state.productionView = e.target.getAttribute('data-view');
            updateProductionChart();
        });
    });
    
    // Refresh data button
    document.getElementById('refreshData').addEventListener('click', () => {
        runSimulationAndReload();
    });
}

// Function to execute the simulation and then reload data
function runSimulationAndReload() {
    showLoading();
    
    // Show message that simulation is running
    showSimulationMessage('Running simulation... This operation may take a few seconds.');
    
    // Disable the refresh button to prevent multiple clicks
    const refreshButton = document.getElementById('refreshData');
    refreshButton.disabled = true;
    refreshButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Running...';
    
    // Call the API endpoint to run the simulation
    fetch('/api/run-simulation')
        .then(response => {
            if (!response.ok) {
                throw new Error('Error running the simulation');
            }
            return response.json();
        })
        .then(data => {
            console.log('Simulation completed:', data);
            hideSimulationMessage();
            
            // Add a small delay to ensure files are fully written
            setTimeout(() => {
                // After running the simulation, load the updated data
                loadDashboardData();
                
                // Re-enable the refresh button
                refreshButton.disabled = false;
                refreshButton.innerHTML = 'Refresh Data';
            }, 1500); // 1.5 second delay
        })
        .catch(error => {
            console.error('Error running simulation:', error);
            hideLoading();
            hideSimulationMessage();
            showErrorMessage('Error running simulation. Please try again.');
            
            // Re-enable the refresh button
            refreshButton.disabled = false;
            refreshButton.innerHTML = 'Refresh Data';
        });
}

// Show simulation in progress message
function showSimulationMessage(message) {
    // Remove previous messages
    hideSimulationMessage();
    
    // Create and show message
    const messageDiv = document.createElement('div');
    messageDiv.id = 'simulationMessage';
    messageDiv.className = 'alert alert-info position-fixed top-50 start-50 translate-middle';
    messageDiv.style.zIndex = '9999';
    messageDiv.innerHTML = `
        <div class="d-flex align-items-center">
            <div class="spinner-border me-3" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
            <div>${message}</div>
        </div>
    `;
    document.body.appendChild(messageDiv);
}

// Hide simulation message
function hideSimulationMessage() {
    const messageDiv = document.getElementById('simulationMessage');
    if (messageDiv) {
        messageDiv.remove();
    }
}

// Load all dashboard data
function loadDashboardData() {
    showLoading();
    
    // Define all data files to load
    const dataFiles = [
        { key: 'daily', path: 'data/daily_production.json' },
        { key: 'workstation', path: 'data/workstation_performance.json' },
        { key: 'plant', path: 'data/plant_performance.json' },
        { key: 'product', path: 'data/product_data.json' },
        { key: 'kpi', path: 'data/kpi_summary.json' }
    ];
    
    // Create array of fetch promises with cache busting
    const fetchPromises = dataFiles.map(file => {
        // Strong cache busting with random component
        const cacheBuster = `?t=${new Date().getTime()}-${Math.random()}`;
        
        console.log(`Fetching ${file.path}${cacheBuster}`);
        return fetch(file.path + cacheBuster, {
            // Add cache control headers to request
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Failed to fetch ${file.path}: ${response.status} ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            // Verify data has timestamp (for debugging)
            if (data && (Array.isArray(data) ? data[0]?.timestamp : data.timestamp)) {
                console.log(`Loaded ${file.key} data with timestamp ${Array.isArray(data) ? data[0].timestamp : data.timestamp}`);
            }
            
            state.data[file.key] = data;
            return data;
        });
    });
    
    // Wait for all data to load
    Promise.all(fetchPromises)
        .then(() => {
            hideLoading();
            updateDashboard();
            updateDashboardSummary(); // Make sure summary is updated too
            showSuccessMessage('Dashboard updated with latest data');
        })
        .catch(error => {
            console.error('Error loading dashboard data:', error);
            hideLoading();
            showErrorMessage('Failed to load dashboard data: ' + error.message);
        });
}

function hideSuccessMessage() {
    const messageDiv = document.getElementById('successMessage');
    if (messageDiv) {
        messageDiv.remove();
    }
}

function showSuccessMessage(message) {
    // Remove any existing messages
    hideSuccessMessage();
    
    // Create and show message
    const messageDiv = document.createElement('div');
    messageDiv.id = 'successMessage';
    messageDiv.className = 'alert alert-success position-fixed top-0 start-50 translate-middle-x mt-2';
    messageDiv.style.zIndex = '9999';
    messageDiv.innerHTML = `
        <div class="d-flex align-items-center">
            <i class="bi bi-check-circle-fill me-2"></i>
            <div>${message}</div>
        </div>
    `;
    document.body.appendChild(messageDiv);
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
        hideSuccessMessage();
    }, 3000);
}

function checkDataFreshness() {
    console.log("Checking data freshness...");
    
    // Check if data has been loaded
    if (!state.data.kpi || !state.data.daily || !state.data.daily.length === 0) {
        console.error("Data not loaded yet");
        return "Data not loaded";
    }
    
    // Get timestamps
    const timestamps = {};
    
    if (Array.isArray(state.data.daily) && state.data.daily.length > 0 && state.data.daily[0].timestamp) {
        timestamps.daily = state.data.daily[0].timestamp;
    }
    
    if (Array.isArray(state.data.workstation) && state.data.workstation.length > 0 && state.data.workstation[0].timestamp) {
        timestamps.workstation = state.data.workstation[0].timestamp;
    }
    
    if (Array.isArray(state.data.plant) && state.data.plant.length > 0 && state.data.plant[0].timestamp) {
        timestamps.plant = state.data.plant[0].timestamp;
    }
    
    if (Array.isArray(state.data.product) && state.data.product.length > 0 && state.data.product[0].timestamp) {
        timestamps.product = state.data.product[0].timestamp;
    }
    
    if (state.data.kpi && state.data.kpi.timestamp) {
        timestamps.kpi = state.data.kpi.timestamp;
    }
    
    console.table(timestamps);
    return timestamps;
}

document.addEventListener('keydown', function(event) {
    // Check for Ctrl+Shift+D
    if (event.ctrlKey && event.shiftKey && event.key === 'D') {
        event.preventDefault();
        const freshness = checkDataFreshness();
        // Add a visual indicator on the page
        showSimulationMessage(`Data Timestamps:<br>${JSON.stringify(freshness, null, 2).replace(/[{}"]/g, '').replace(/,/g, '<br>').replace(/:/g, ': ')}`);
        // Auto-hide after 5 seconds
        setTimeout(hideSimulationMessage, 5000);
    }
});

// Update all dashboard components
function updateDashboard() {
    try {
        updateKPIs();
        updateProductionChart();
        updateWorkstationStatus();
        updateWorkstationPerformance();
        updateSupplierOccupancy();
        updateProductQuality();
        updateWorkstationDetails();
    } catch (error) {
        console.error("Error updating dashboard:", error);
        showErrorMessage("An error occurred while updating the dashboard. Please try refreshing the page.");
    }
}

// Update KPI cards
function updateKPIs() {
    if (!state.data.kpi || !state.data.plant) return;
    
    // Get KPI data
    const kpiData = state.data.kpi;
    
    // Format values for display
    const totalProduction = Math.round(kpiData.avg_daily_production).toLocaleString();
    const qualityRate = kpiData.avg_quality_percentage.toFixed(1) + '%';
    const downtime = kpiData.avg_downtime_hours.toFixed(1) + ' hrs';
    const bottleneck = 'WS ' + kpiData.bottleneck_workstation;
    
    // Update KPI elements
    document.getElementById('kpiTotalProduction').textContent = totalProduction;
    document.getElementById('kpiQualityRate').textContent = qualityRate;
    document.getElementById('kpiDowntime').textContent = downtime;
    document.getElementById('kpiBottleneck').textContent = bottleneck;
    
    // Add additional context
    document.getElementById('kpiTotalProductionChange').textContent = 'Per day (averaged across runs)';
    document.getElementById('kpiQualityRateChange').textContent = 'Good products / Total production';
    document.getElementById('kpiDowntimeChange').textContent = 'Average across all workstations';
    document.getElementById('kpiBottleneckInfo').textContent = `Workstation with highest downtime`;
}

// Create and update production chart
function updateProductionChart() {
    if (!state.data.daily) return;
    
    // Clear previous chart
    d3.select('#productionChart').html('');
    
    // Get aggregated data based on time range
    const aggregatedData = aggregateTimeSeriesData(state.data.daily, state.timeRange);
    
    // Prepare dimensions
    const container = document.getElementById('productionChart');
    const width = container.clientWidth;
    const height = container.clientHeight;
    const margin = { top: 20, right: 80, bottom: 60, left: 60 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    
    // Create SVG
    const svg = d3.select('#productionChart')
        .append('svg')
        .attr('width', width)
        .attr('height', height);
    
    // Create chart group
    const chart = svg.append('g')
        .attr('transform', `translate(${margin.left}, ${margin.top})`);
    
    // Define scales
    const xScale = d3.scaleBand()
        .domain(aggregatedData.map(d => d.period))
        .range([0, innerWidth])
        .padding(0.1);
    
    const maxY = state.productionView === 'production' 
        ? d3.max(aggregatedData, d => d.production) * 1.1
        : 100;
    
    const yScale = d3.scaleLinear()
        .domain([0, maxY])
        .range([innerHeight, 0]);
    
    // Add X axis
    chart.append('g')
        .attr('transform', `translate(0, ${innerHeight})`)
        .call(d3.axisBottom(xScale))
        .selectAll('text')
        .style('text-anchor', 'end')
        .attr('dx', '-.8em')
        .attr('dy', '.15em')
        .attr('transform', 'rotate(-45)');
    
    // Add Y axis
    chart.append('g')
        .call(d3.axisLeft(yScale));
    
    // Add axis labels
    chart.append('text')
        .attr('class', 'axis-label')
        .attr('text-anchor', 'middle')
        .attr('x', innerWidth / 2)
        .attr('y', innerHeight + 50)
        .text(getTimeRangeLabel(state.timeRange));
    
    chart.append('text')
        .attr('class', 'axis-label')
        .attr('text-anchor', 'middle')
        .attr('transform', 'rotate(-90)')
        .attr('x', -innerHeight / 2)
        .attr('y', -40)
        .text(state.productionView === 'production' ? 'Production Count' : 'Quality Rate (%)');
    
    // Add bars or line based on view
    if (state.productionView === 'production') {
        // Create bars for production
        chart.selectAll('.bar')
            .data(aggregatedData)
            .enter()
            .append('rect')
            .attr('class', 'bar')
            .attr('x', d => xScale(d.period))
            .attr('y', d => yScale(d.production))
            .attr('width', xScale.bandwidth())
            .attr('height', d => innerHeight - yScale(d.production))
            .attr('fill', '#4e79a7')
            .on('mouseover', function(event, d) {
                showTooltip(event, `
                    <strong>${d.period}</strong><br>
                    Production: ${d.production.toLocaleString()}<br>
                    Faulty: ${d.faulty.toLocaleString()} (${((d.faulty / d.production) * 100).toFixed(1)}%)
                `);
                d3.select(this).attr('fill', '#1e4977');
            })
            .on('mouseout', function() {
                hideTooltip();
                d3.select(this).attr('fill', '#4e79a7');
            });
        
        // Add faulty product overlay
        chart.selectAll('.faulty-bar')
            .data(aggregatedData)
            .enter()
            .append('rect')
            .attr('class', 'faulty-bar')
            .attr('x', d => xScale(d.period))
            .attr('y', d => yScale(d.faulty))
            .attr('width', xScale.bandwidth())
            .attr('height', d => innerHeight - yScale(d.faulty))
            .attr('fill', '#e15759')
            .attr('opacity', 0.7)
            .on('mouseover', function(event, d) {
                showTooltip(event, `
                    <strong>${d.period}</strong><br>
                    Faulty: ${d.faulty.toLocaleString()}<br>
                    (${((d.faulty / d.production) * 100).toFixed(1)}% of total)
                `);
                d3.select(this).attr('opacity', 1);
            })
            .on('mouseout', function() {
                hideTooltip();
                d3.select(this).attr('opacity', 0.7);
            });
            
        // Add legend
        const legend = svg.append('g')
            .attr('transform', `translate(${width - margin.right + 10}, ${margin.top})`);
            
        // Production legend item
        legend.append('rect')
            .attr('width', 15)
            .attr('height', 15)
            .attr('fill', '#4e79a7');
            
        legend.append('text')
            .attr('x', 20)
            .attr('y', 12)
            .text('Total Production')
            .style('font-size', '12px');
            
        // Faulty legend item
        legend.append('rect')
            .attr('width', 15)
            .attr('height', 15)
            .attr('y', 20)
            .attr('fill', '#e15759')
            .attr('opacity', 0.7);
            
        legend.append('text')
            .attr('x', 20)
            .attr('y', 32)
            .text('Faulty Products')
            .style('font-size', '12px');
    } else {
        // Create line for quality rate
        const line = d3.line()
            .x(d => xScale(d.period) + xScale.bandwidth() / 2)
            .y(d => yScale((1 - d.faulty / d.production) * 100));
        
        // Add the line
        chart.append('path')
            .datum(aggregatedData)
            .attr('fill', 'none')
            .attr('stroke', '#28a745')
            .attr('stroke-width', 3)
            .attr('d', line);
        
        // Add data points
        chart.selectAll('.data-point')
            .data(aggregatedData)
            .enter()
            .append('circle')
            .attr('class', 'data-point')
            .attr('cx', d => xScale(d.period) + xScale.bandwidth() / 2)
            .attr('cy', d => yScale((1 - d.faulty / d.production) * 100))
            .attr('r', 5)
            .attr('fill', '#28a745')
            .on('mouseover', function(event, d) {
                const qualityRate = ((1 - d.faulty / d.production) * 100).toFixed(1);
                showTooltip(event, `
                    <strong>${d.period}</strong><br>
                    Quality Rate: ${qualityRate}%<br>
                    Good: ${(d.production - d.faulty).toLocaleString()}<br>
                    Total: ${d.production.toLocaleString()}
                `);
                d3.select(this).attr('r', 7);
            })
            .on('mouseout', function() {
                hideTooltip();
                d3.select(this).attr('r', 5);
            });
    }
}

// Create and update supplier occupancy & bottleneck chart
function updateSupplierOccupancy() {
    if (!state.data.plant) return;
    
    // Clear previous chart
    d3.select('#supplierOccupancy').html('');
    
    // Get plant data
    const plantData = state.data.plant;
    
    // Prepare dimensions
    const container = document.getElementById('supplierOccupancy');
    const width = container.clientWidth;
    const height = container.clientHeight;
    const margin = { top: 20, right: 30, bottom: 50, left: 60 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    
    // Create SVG
    const svg = d3.select('#supplierOccupancy')
        .append('svg')
        .attr('width', width)
        .attr('height', height);
    
    // Create chart group
    const chart = svg.append('g')
        .attr('transform', `translate(${margin.left}, ${margin.top})`);
    
    // Define scales
    const xScale = d3.scaleLinear()
        .domain([0, d3.max(plantData, d => d.supplier_occupancy) * 1.1])
        .range([0, innerWidth]);
    
    const yScale = d3.scaleLinear()
        .domain([0, d3.max(plantData, d => d.bottleneck_delay) * 1.1])
        .range([innerHeight, 0]);
    
    // Add X axis
    chart.append('g')
        .attr('transform', `translate(0, ${innerHeight})`)
        .call(d3.axisBottom(xScale).ticks(5));
    
    // Add Y axis
    chart.append('g')
        .call(d3.axisLeft(yScale).ticks(5));
    
    // Add axis labels
    chart.append('text')
        .attr('class', 'axis-label')
        .attr('text-anchor', 'middle')
        .attr('x', innerWidth / 2)
        .attr('y', innerHeight + 35)
        .text('Supplier Occupancy (hours)');
    
    chart.append('text')
        .attr('class', 'axis-label')
        .attr('text-anchor', 'middle')
        .attr('transform', 'rotate(-90)')
        .attr('x', -innerHeight / 2)
        .attr('y', -40)
        .text('Bottleneck Delay (hours)');
    
    // Add scatter plot points
    chart.selectAll('.point')
        .data(plantData)
        .enter()
        .append('circle')
        .attr('class', 'point')
        .attr('cx', d => xScale(d.supplier_occupancy))
        .attr('cy', d => yScale(d.bottleneck_delay))
        .attr('r', 6)
        .attr('fill', '#4e79a7')
        .attr('opacity', 0.7)
        .on('mouseover', function(event, d) {
            showTooltip(event, `
                <strong>Run: ${d.run + 1}</strong><br>
                Supplier Occupancy: ${d.supplier_occupancy.toFixed(1)} hrs<br>
                Bottleneck Delay: ${d.bottleneck_delay.toFixed(1)} hrs<br>
                Production: ${d.total_production.toLocaleString()} units
            `);
            d3.select(this).attr('r', 8).attr('opacity', 1);
        })
        .on('mouseout', function() {
            hideTooltip();
            d3.select(this).attr('r', 6).attr('opacity', 0.7);
        });
    
    // Add trend line
    const trendData = plantData.map(d => ({
        x: d.supplier_occupancy,
        y: d.bottleneck_delay
    }));
    
    // Calculate linear regression
    const xValues = trendData.map(d => d.x);
    const yValues = trendData.map(d => d.y);
    
    const xMean = d3.mean(xValues);
    const yMean = d3.mean(yValues);
    
    const numerator = d3.sum(trendData.map((d, i) => (d.x - xMean) * (d.y - yMean)));
    const denominator = d3.sum(trendData.map(d => Math.pow(d.x - xMean, 2)));
    
    const slope = numerator / denominator;
    const intercept = yMean - slope * xMean;
    
    // Create line function
    const line = d3.line()
        .x(d => xScale(d))
        .y(d => yScale(slope * d + intercept));
    
    // Add the line
    chart.append('path')
        .datum([0, d3.max(plantData, d => d.supplier_occupancy) * 1.1])
        .attr('fill', 'none')
        .attr('stroke', '#f44336')
        .attr('stroke-width', 2)
        .attr('d', line);
        
    // Calculate correlation coefficient
    const correlation = numerator / (Math.sqrt(denominator) * Math.sqrt(d3.sum(trendData.map(d => Math.pow(d.y - yMean, 2)))));
    
    // Add correlation text
    chart.append('text')
        .attr('x', innerWidth - 120)
        .attr('y', 20)
        .attr('text-anchor', 'start')
        .text(`Correlation: ${correlation.toFixed(2)}`)
        .style('font-size', '12px')
        .style('font-weight', 'bold');
}

// Create and update workstation performance chart
function updateWorkstationPerformance() {
    if (!state.data.workstation) return;
    
    // Clear previous chart
    d3.select('#workstationPerformance').html('');
    
    // Group data by workstation
    const workstationGroups = _.groupBy(state.data.workstation, 'workstation');
    
    // Calculate average metrics for each workstation
    const workstationData = Object.entries(workstationGroups).map(([ws, data]) => {
        return {
            workstation: parseInt(ws),
            downtime: d3.mean(data, d => d.downtime),
            waiting_time: d3.mean(data, d => d.waiting_time),
            active_time: d3.mean(data, d => d.active_time),
            failure_probability: data[0].failure_probability
        };
    });
    
    // Sort by workstation number
    workstationData.sort((a, b) => a.workstation - b.workstation);
    
    // Prepare dimensions
    const container = document.getElementById('workstationPerformance');
    const width = container.clientWidth;
    const height = container.clientHeight;
    const margin = { top: 20, right: 30, bottom: 50, left: 60 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    
    // Create SVG
    const svg = d3.select('#workstationPerformance')
        .append('svg')
        .attr('width', width)
        .attr('height', height);
    
    // Create chart group
    const chart = svg.append('g')
        .attr('transform', `translate(${margin.left}, ${margin.top})`);
    
    // Define scales
    const xScale = d3.scaleBand()
        .domain(workstationData.map(d => `WS ${d.workstation}`))
        .range([0, innerWidth])
        .padding(0.3);
    
    // Determine which metric to display based on user selection
    let metricKey, metricLabel;
    switch (state.wsMetric) {
        case 'downtime':
            metricKey = 'downtime';
            metricLabel = 'Downtime';
            break;
        case 'waiting':
            metricKey = 'waiting_time';
            metricLabel = 'Waiting Time';
            break;
        case 'active':
            metricKey = 'active_time';
            metricLabel = 'Active Time';
            break;
    }
    
    const yScale = d3.scaleLinear()
        .domain([0, d3.max(workstationData, d => d[metricKey]) * 1.1])
        .range([innerHeight, 0]);
    
    // Add X axis
    chart.append('g')
        .attr('transform', `translate(0, ${innerHeight})`)
        .call(d3.axisBottom(xScale));
    
    // Add Y axis
    chart.append('g')
        .call(d3.axisLeft(yScale).ticks(5));
    
    // Add axis labels
    chart.append('text')
        .attr('class', 'axis-label')
        .attr('text-anchor', 'middle')
        .attr('x', innerWidth / 2)
        .attr('y', innerHeight + 35)
        .text('Workstation');
    
    chart.append('text')
        .attr('class', 'axis-label')
        .attr('text-anchor', 'middle')
        .attr('transform', 'rotate(-90)')
        .attr('x', -innerHeight / 2)
        .attr('y', -40)
        .text(`${metricLabel} (Hours)`);
    
    // Add bars for the selected metric
    chart.selectAll('.ws-bar')
        .data(workstationData)
        .enter()
        .append('rect')
        .attr('class', 'ws-bar')
        .attr('x', d => xScale(`WS ${d.workstation}`))
        .attr('y', d => yScale(d[metricKey]))
        .attr('width', xScale.bandwidth())
        .attr('height', d => innerHeight - yScale(d[metricKey]))
        .attr('fill', d => {
            // Color code based on how good/bad the value is
            const normalizedValue = d[metricKey] / d3.max(workstationData, d => d[metricKey]);
            if (metricKey === 'active_time') {
                // For active time, higher is better (greener)
                return d3.interpolateRgb('#e8f5e9', '#2e7d32')(normalizedValue);
            } else {
                // For downtime and waiting time, lower is better (greener)
                return d3.interpolateRgb('#2e7d32', '#c62828')(normalizedValue);
            }
        })
        .on('mouseover', function(event, d) {
            showTooltip(event, `
                <strong>Workstation ${d.workstation}</strong><br>
                ${metricLabel}: ${d[metricKey].toFixed(1)} hours<br>
                Failure Probability: ${(d.failure_probability * 100).toFixed(1)}%
            `);
            d3.select(this).attr('opacity', 0.8);
        })
        .on('mouseout', function() {
            hideTooltip();
            d3.select(this).attr('opacity', 1);
        });
    
    // Add failure probability line
    const line = d3.line()
        .x(d => xScale(`WS ${d.workstation}`) + xScale.bandwidth() / 2)
        .y(d => yScale(d.failure_probability * d3.max(workstationData, d => d[metricKey]) * 5));
    
    chart.append('path')
        .datum(workstationData)
        .attr('fill', 'none')
        .attr('stroke', '#ff9800')
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '5,5')
        .attr('d', line);
    
    chart.selectAll('.failure-point')
        .data(workstationData)
        .enter()
        .append('circle')
        .attr('class', 'failure-point')
        .attr('cx', d => xScale(`WS ${d.workstation}`) + xScale.bandwidth() / 2)
        .attr('cy', d => yScale(d.failure_probability * d3.max(workstationData, d => d[metricKey]) * 5))
        .attr('r', 4)
        .attr('fill', '#ff9800')
        .on('mouseover', function(event, d) {
            showTooltip(event, `
                <strong>Workstation ${d.workstation}</strong><br>
                Failure Probability: ${(d.failure_probability * 100).toFixed(1)}%
            `);
            d3.select(this).attr('r', 6);
        })
        .on('mouseout', function() {
            hideTooltip();
            d3.select(this).attr('r', 4);
        });
    
    // Add legend
    const legend = svg.append('g')
        .attr('transform', `translate(${innerWidth + margin.left - 40}, ${margin.top})`);
    
    legend.append('rect')
        .attr('width', 12)
        .attr('height', 12)
        .attr('fill', state.wsMetric === 'active_time' ? '#2e7d32' : '#c62828');
    
    legend.append('text')
        .attr('x', 16)
        .attr('y', 10)
        .text(metricLabel)
        .style('font-size', '10px');
    
    legend.append('line')
        .attr('x1', 0)
        .attr('y1', 25)
        .attr('x2', 12)
        .attr('y2', 25)
        .attr('stroke', '#ff9800')
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '5,5');
    
    legend.append('circle')
        .attr('cx', 6)
        .attr('cy', 25)
        .attr('r', 4)
        .attr('fill', '#ff9800');
    
    legend.append('text')
        .attr('x', 16)
        .attr('y', 28)
        .text('Failure Probability')
        .style('font-size', '10px');
}

// Create and update workstation status visualization
function updateWorkstationStatus() {
    if (!state.data.workstation) return;
    
    // Clear previous chart
    d3.select('#workstationStatus').html('');
    
    // Group data by workstation
    const workstationGroups = _.groupBy(state.data.workstation, 'workstation');
    
    // Calculate average status percentages for each workstation
    const workstationData = Object.entries(workstationGroups).map(([ws, data]) => {
        const avgData = {
            workstation: parseInt(ws),
            active_percentage: d3.mean(data, d => d.active_percentage),
            waiting_percentage: d3.mean(data, d => d.waiting_percentage),
            downtime_percentage: d3.mean(data, d => d.downtime_percentage)
        };
        return avgData;
    });
    
    // Sort by workstation number
    workstationData.sort((a, b) => a.workstation - b.workstation);
    
    // Prepare dimensions
    const container = document.getElementById('workstationStatus');
    const width = container.clientWidth;
    const height = container.clientHeight;
    const margin = { top: 20, right: 30, bottom: 50, left: 60 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    
    // Create SVG
    const svg = d3.select('#workstationStatus')
        .append('svg')
        .attr('width', width)
        .attr('height', height);
    
    // Create chart group
    const chart = svg.append('g')
        .attr('transform', `translate(${margin.left}, ${margin.top})`);
    
    // Define scales
    const xScale = d3.scaleBand()
        .domain(workstationData.map(d => `WS ${d.workstation}`))
        .range([0, innerWidth])
        .padding(0.2);
    
    const yScale = d3.scaleLinear()
        .domain([0, 100])
        .range([innerHeight, 0]);
    
    // Add X axis
    chart.append('g')
        .attr('transform', `translate(0, ${innerHeight})`)
        .call(d3.axisBottom(xScale));
    
    // Add Y axis
    chart.append('g')
        .call(d3.axisLeft(yScale).ticks(5).tickFormat(d => d + '%'));
    
    // Add axis labels
    chart.append('text')
        .attr('class', 'axis-label')
        .attr('text-anchor', 'middle')
        .attr('x', innerWidth / 2)
        .attr('y', innerHeight + 35)
        .text('Workstation');
    
    chart.append('text')
        .attr('class', 'axis-label')
        .attr('text-anchor', 'middle')
        .attr('transform', 'rotate(-90)')
        .attr('x', -innerHeight / 2)
        .attr('y', -40)
        .text('Time Distribution (%)');
    
    // Create stacked data for each workstation
    workstationData.forEach(ws => {
        // Create the three segments: active, waiting, downtime
        const barWidth = xScale.bandwidth();
        const x = xScale(`WS ${ws.workstation}`);
        
        // Active time (bottom)
        chart.append('rect')
            .attr('x', x)
            .attr('y', yScale(ws.active_percentage))
            .attr('width', barWidth)
            .attr('height', innerHeight - yScale(ws.active_percentage))
            .attr('fill', colorScales.status('active'))
            .on('mouseover', function(event) {
                showTooltip(event, `
                    <strong>Workstation ${ws.workstation}</strong><br>
                    Active Time: ${ws.active_percentage.toFixed(1)}%
                `);
            })
            .on('mouseout', hideTooltip);
        
        // Waiting time (middle)
        chart.append('rect')
            .attr('x', x)
            .attr('y', yScale(ws.active_percentage + ws.waiting_percentage))
            .attr('width', barWidth)
            .attr('height', yScale(ws.active_percentage) - yScale(ws.active_percentage + ws.waiting_percentage))
            .attr('fill', colorScales.status('waiting'))
            .on('mouseover', function(event) {
                showTooltip(event, `
                    <strong>Workstation ${ws.workstation}</strong><br>
                    Waiting Time: ${ws.waiting_percentage.toFixed(1)}%
                `);
            })
            .on('mouseout', hideTooltip);
        
        // Downtime (top)
        chart.append('rect')
            .attr('x', x)
            .attr('y', yScale(100))
            .attr('width', barWidth)
            .attr('height', yScale(ws.active_percentage + ws.waiting_percentage) - yScale(100))
            .attr('fill', colorScales.status('downtime'))
            .on('mouseover', function(event) {
                showTooltip(event, `
                    <strong>Workstation ${ws.workstation}</strong><br>
                    Downtime: ${ws.downtime_percentage.toFixed(1)}%
                `);
            })
            .on('mouseout', hideTooltip);
    });
    
    // Add legend
    const legend = svg.append('g')
        .attr('transform', `translate(${margin.left}, ${margin.top - 10})`);
    
    const legendItems = [
        { label: 'Active', color: colorScales.status('active') },
        { label: 'Waiting', color: colorScales.status('waiting') },
        { label: 'Downtime', color: colorScales.status('downtime') }
    ];
    
    legendItems.forEach((item, i) => {
        const legendItem = legend.append('g')
            .attr('transform', `translate(${i * 70}, 0)`);
        
        legendItem.append('rect')
            .attr('width', 12)
            .attr('height', 12)
            .attr('fill', item.color);
        
        legendItem.append('text')
            .attr('x', 16)
            .attr('y', 10)
            .text(item.label)
            .style('font-size', '10px');
    });
}

// Create and update workstation details chart
function updateWorkstationDetails() {
    if (!state.data.workstation || !state.data.daily) return;
    
    // Clear previous chart
    d3.select('#workstationDetails').html('');
    
    // Filter data for selected workstation
    const wsData = state.data.workstation.filter(d => d.workstation === state.selectedWorkstation);
    
    // Get daily data for this workstation
    const dailyData = state.data.daily.slice(0, 30); // Limit to first 30 days for clearer visualization
    
    // Prepare dimensions
    const container = document.getElementById('workstationDetails');
    const width = container.clientWidth;
    const height = container.clientHeight;
    const margin = { top: 20, right: 30, bottom: 50, left: 60 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    
    // Create SVG
    const svg = d3.select('#workstationDetails')
        .append('svg')
        .attr('width', width)
        .attr('height', height);
    
    // Create chart group
    const chart = svg.append('g')
        .attr('transform', `translate(${margin.left}, ${margin.top})`);
    
    // Define scales
    const xScale = d3.scaleLinear()
        .domain([0, dailyData.length - 1])
        .range([0, innerWidth]);
        
    const yScale = d3.scaleLinear()
        .domain([0, d3.max(dailyData, d => d.workstation_downtime[state.selectedWorkstation - 1]) * 1.5])
        .range([innerHeight, 0]);
    
    // Add X axis
    chart.append('g')
        .attr('transform', `translate(0, ${innerHeight})`)
        .call(d3.axisBottom(xScale).ticks(10).tickFormat(d => `Day ${d + 1}`));
    
    // Add Y axis
    chart.append('g')
        .call(d3.axisLeft(yScale).ticks(5));
    
    // Add axis labels
    chart.append('text')
        .attr('class', 'axis-label')
        .attr('text-anchor', 'middle')
        .attr('x', innerWidth / 2)
        .attr('y', innerHeight + 35)
        .text('Day');
    
    chart.append('text')
        .attr('class', 'axis-label')
        .attr('text-anchor', 'middle')
        .attr('transform', 'rotate(-90)')
        .attr('x', -innerHeight / 2)
        .attr('y', -40)
        .text('Downtime (Hours)');
    
    // Create line for downtime
    const line = d3.line()
        .x((d, i) => xScale(i))
        .y(d => yScale(d.workstation_downtime[state.selectedWorkstation - 1]));
    
    // Add the line
    chart.append('path')
        .datum(dailyData)
        .attr('fill', 'none')
        .attr('stroke', colorScales.workstations(state.selectedWorkstation))
        .attr('stroke-width', 2)
        .attr('d', line);
    
    // Add data points
    chart.selectAll('.data-point')
        .data(dailyData)
        .enter()
        .append('circle')
        .attr('class', 'data-point')
        .attr('cx', (d, i) => xScale(i))
        .attr('cy', d => yScale(d.workstation_downtime[state.selectedWorkstation - 1]))
        .attr('r', 4)
        .attr('fill', colorScales.workstations(state.selectedWorkstation))
        .on('mouseover', function(event, d) {
            showTooltip(event, `
                <strong>Day: ${d.date}</strong><br>
                Workstation ${state.selectedWorkstation} Downtime: ${d.workstation_downtime[state.selectedWorkstation - 1].toFixed(1)} hrs
            `);
            d3.select(this).attr('r', 6);
        })
        .on('mouseout', function() {
            hideTooltip();
            d3.select(this).attr('r', 4);
        });
    
    // Add average line
    const avgDowntime = d3.mean(dailyData, d => d.workstation_downtime[state.selectedWorkstation - 1]);
    
    chart.append('line')
        .attr('x1', 0)
        .attr('y1', yScale(avgDowntime))
        .attr('x2', innerWidth)
        .attr('y2', yScale(avgDowntime))
        .attr('stroke', '#f44336')
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '5,5');
    
    chart.append('text')
        .attr('x', innerWidth - 100)
        .attr('y', yScale(avgDowntime) - 8)
        .attr('text-anchor', 'end')
        .text(`Avg: ${avgDowntime.toFixed(1)} hrs`)
        .style('font-size', '10px')
        .style('fill', '#f44336');
    
    // Add workstation info
    const wsStats = wsData[0];
    if (wsStats) {
        chart.append('text')
            .attr('x', 10)
            .attr('y', 20)
            .text(`Workstation ${state.selectedWorkstation} Stats:`)
            .style('font-weight', 'bold');
        
        chart.append('text')
            .attr('x', 10)
            .attr('y', 40)
            .text(`Failure Rate: ${(wsStats.failure_probability * 100).toFixed(1)}%`);
        
        chart.append('text')
            .attr('x', 10)
            .attr('y', 60)
            .text(`Active Time: ${wsStats.active_percentage.toFixed(1)}%`);
        
        chart.append('text')
            .attr('x', 10)
            .attr('y', 80)
            .text(`Waiting Time: ${wsStats.waiting_percentage.toFixed(1)}%`);
    }
}

function updateStorytellingElements() {
    try {
        updateKPIInsights();
        updateProductionInsights();
        updateWorkstationStatusInsights();
        updateWorkstationPerformanceInsights();
        updateSupplierInsights();
        updateQualityInsights();
        updateWorkstationDetailsInsights();
    } catch (error) {
        console.error("Error updating storytelling elements:", error);
    }
}

// Update KPI card insights
function updateKPIInsights() {
    if (!state.data.kpi) return;
    
    const kpiData = state.data.kpi;
    
    // Production insight
    const productionTarget = 1200; // Example target
    const avgProduction = Math.round(kpiData.avg_daily_production);
    const productionDiff = avgProduction - productionTarget;
    const productionInsight = document.getElementById('productionInsight');
    
    if (productionDiff >= 0) {
        productionInsight.textContent = `Exceeding target by ${productionDiff} units/day (${Math.round(productionDiff/productionTarget*100)}%)`;
        productionInsight.classList.add('text-success');
    } else {
        productionInsight.textContent = `Below target by ${Math.abs(productionDiff)} units/day (${Math.round(Math.abs(productionDiff)/productionTarget*100)}%)`;
        productionInsight.classList.add('text-danger');
    }
    
    // Quality insight
    const qualityTarget = 95; // Example target
    const avgQuality = kpiData.avg_quality_percentage;
    const qualityDiff = avgQuality - qualityTarget;
    const qualityInsight = document.getElementById('qualityInsight');
    
    if (qualityDiff >= 0) {
        qualityInsight.textContent = `Above industry benchmark by ${qualityDiff.toFixed(1)}%`;
        qualityInsight.classList.add('text-success');
    } else {
        qualityInsight.textContent = `Below industry benchmark by ${Math.abs(qualityDiff).toFixed(1)}%`;
        qualityInsight.classList.add('text-danger');
    }
    
    // Downtime insight
    const downtimeTarget = 8; // Example target in hours
    const avgDowntime = kpiData.avg_downtime_hours;
    const downtimeDiff = avgDowntime - downtimeTarget;
    const downtimeInsight = document.getElementById('downtimeInsight');
    
    if (downtimeDiff <= 0) {
        downtimeInsight.textContent = `${Math.abs(downtimeDiff).toFixed(1)} hrs below target - Good performance`;
        downtimeInsight.classList.add('text-success');
    } else {
        downtimeInsight.textContent = `${downtimeDiff.toFixed(1)} hrs above target - Needs improvement`;
        downtimeInsight.classList.add('text-danger');
    }
    
    // Bottleneck action
    const bottleneckAction = document.getElementById('bottleneckAction');
    bottleneckAction.textContent = `Focus on reducing downtime at WS ${kpiData.bottleneck_workstation}`;
}

// Update production chart insights
function updateProductionInsights() {
    if (!state.data.daily || state.data.daily.length === 0) return;
    
    const aggregatedData = aggregateTimeSeriesData(state.data.daily, state.timeRange);
    
    // Find trend by comparing first and last period
    if (aggregatedData.length >= 2) {
        const firstPeriod = aggregatedData[0].production;
        const lastPeriod = aggregatedData[aggregatedData.length - 1].production;
        const percentChange = ((lastPeriod - firstPeriod) / firstPeriod * 100).toFixed(1);
        
        const insightElement = document.getElementById('productionInsight');
        const actionElement = document.getElementById('productionAction');
        
        if (percentChange > 0) {
            insightElement.innerHTML = `<i class="bi bi-graph-up"></i> Production increased by ${percentChange}% from ${aggregatedData[0].period} to ${aggregatedData[aggregatedData.length - 1].period}`;
            
            // If quality is trending down while production is up
            if (state.data.kpi && state.data.kpi.avg_quality_percentage < 90) {
                actionElement.innerHTML = `<i class="bi bi-exclamation-triangle"></i> Consider balancing production speed with quality control measures`;
            } else {
                actionElement.innerHTML = `<i class="bi bi-check-circle"></i> Continue current production optimization strategy`;
            }
        } else if (percentChange < 0) {
            insightElement.innerHTML = `<i class="bi bi-graph-down"></i> Production decreased by ${Math.abs(percentChange)}% from ${aggregatedData[0].period} to ${aggregatedData[aggregatedData.length - 1].period}`;
            actionElement.innerHTML = `<i class="bi bi-tools"></i> Investigate bottlenecks and consider process improvements`;
        } else {
            insightElement.innerHTML = `<i class="bi bi-dash"></i> Production has remained stable over the selected time period`;
            actionElement.innerHTML = `<i class="bi bi-arrow-up-circle"></i> Look for opportunities to increase production capacity`;
        }
    }
}

// Update workstation status insights
function updateWorkstationStatusInsights() {
    if (!state.data.workstation) return;
    
    const workstationGroups = _.groupBy(state.data.workstation, 'workstation');
    const avgDowntimeByWS = [];
    
    // Calculate average downtime for each workstation
    Object.entries(workstationGroups).forEach(([ws, data]) => {
        avgDowntimeByWS.push({
            workstation: parseInt(ws),
            downtime_percentage: d3.mean(data, d => d.downtime_percentage)
        });
    });
    
    // Sort by downtime percentage (descending)
    avgDowntimeByWS.sort((a, b) => b.downtime_percentage - a.downtime_percentage);
    
    // Get top 2 workstations with highest downtime
    const topDowntimeWS = avgDowntimeByWS.slice(0, 2);
    
    const insightElement = document.getElementById('wsStatusInsight');
    
    if (topDowntimeWS.length > 0) {
        insightElement.innerHTML = `<i class="bi bi-exclamation-circle"></i> Workstations ${topDowntimeWS.map(d => d.workstation).join(' and ')} have the highest downtime (${topDowntimeWS[0].downtime_percentage.toFixed(1)}% and ${topDowntimeWS[1].downtime_percentage.toFixed(1)}% respectively). Focus maintenance efforts here.`;
    }
}

// Update workstation performance insights
function updateWorkstationPerformanceInsights() {
    if (!state.data.workstation) return;
    
    const insightElement = document.getElementById('wsPerformanceInsight');
    
    // Different insights based on selected metric
    switch (state.wsMetric) {
        case 'downtime':
            insightElement.innerHTML = `<i class="bi bi-info-circle"></i> Workstations with higher failure probability tend to have more downtime. Consider preventive maintenance schedules.`;
            break;
        case 'waiting':
            insightElement.innerHTML = `<i class="bi bi-info-circle"></i> High waiting time indicates upstream bottlenecks or supply issues. Review material flow and inventory management.`;
            break;
        case 'active':
            insightElement.innerHTML = `<i class="bi bi-info-circle"></i> Higher active time percentage indicates better workstation utilization. Look at high performers for best practices.`;
            break;
    }
}

// Update supplier insights
function updateSupplierInsights() {
    if (!state.data.plant) return;
    
    const insightElement = document.getElementById('supplierInsight');
    
    // Calculate correlation between supplier occupancy and bottleneck delay
    const xValues = state.data.plant.map(d => d.supplier_occupancy);
    const yValues = state.data.plant.map(d => d.bottleneck_delay);
    
    const xMean = d3.mean(xValues);
    const yMean = d3.mean(yValues);
    
    const numerator = d3.sum(state.data.plant.map((d, i) => (d.supplier_occupancy - xMean) * (d.bottleneck_delay - yMean)));
    const denominator = Math.sqrt(d3.sum(state.data.plant.map(d => Math.pow(d.supplier_occupancy - xMean, 2))) * 
                               d3.sum(state.data.plant.map(d => Math.pow(d.bottleneck_delay - yMean, 2))));
    
    const correlation = numerator / denominator;
    
    if (correlation > 0.7) {
        insightElement.innerHTML = `<i class="bi bi-exclamation-circle"></i> Strong correlation (${correlation.toFixed(2)}) between supplier occupancy and bottleneck delays. Consider adding more suppliers or optimizing delivery schedules.`;
    } else if (correlation > 0.3) {
        insightElement.innerHTML = `<i class="bi bi-info-circle"></i> Moderate correlation (${correlation.toFixed(2)}) between supplier occupancy and delays. Monitor for trends.`;
    } else {
        insightElement.innerHTML = `<i class="bi bi-check-circle"></i> Weak correlation (${correlation.toFixed(2)}) between supplier occupancy and delays. Supply chain appears well-balanced.`;
    }
}

// Update quality insights
function updateQualityInsights() {
    if (!state.data.product) return;
    
    const productGroups = _.groupBy(state.data.product, 'product_type');
    const qualityByProduct = [];
    
    // Calculate average quality for each product type
    Object.entries(productGroups).forEach(([type, data]) => {
        qualityByProduct.push({
            product_type: type,
            quality_rate: d3.mean(data, d => d.quality_rate)
        });
    });
    
    // Sort by quality rate (ascending - worst first)
    qualityByProduct.sort((a, b) => a.quality_rate - b.quality_rate);
    
    const insightElement = document.getElementById('qualityDistributionInsight');
    
    if (qualityByProduct.length > 0) {
        const worstProduct = qualityByProduct[0];
        const bestProduct = qualityByProduct[qualityByProduct.length - 1];
        
        if (bestProduct.quality_rate - worstProduct.quality_rate > 5) {
            insightElement.innerHTML = `<i class="bi bi-exclamation-circle"></i> ${worstProduct.product_type} has significantly lower quality (${worstProduct.quality_rate.toFixed(1)}%) than ${bestProduct.product_type} (${bestProduct.quality_rate.toFixed(1)}%). Investigate production differences.`;
        } else {
            insightElement.innerHTML = `<i class="bi bi-check-circle"></i> Quality rates are relatively consistent across product types (range: ${worstProduct.quality_rate.toFixed(1)}% - ${bestProduct.quality_rate.toFixed(1)}%).`;
        }
    }
}

// Update workstation details insights
function updateWorkstationDetailsInsights() {
    if (!state.data.workstation || !state.data.daily) return;
    
    const wsData = state.data.workstation.filter(d => d.workstation === state.selectedWorkstation);
    const dailyData = state.data.daily.slice(0, 30);
    
    const insightElement = document.getElementById('wsDetailsInsight');
    
    if (wsData.length > 0 && dailyData.length > 0) {
        // Calculate trend
        const downtimeTrend = [];
        
        for (let i = 0; i < dailyData.length; i++) {
            downtimeTrend.push(dailyData[i].workstation_downtime[state.selectedWorkstation - 1]);
        }
        
        // Find peaks in downtime (values significantly above average)
        const avgDowntime = d3.mean(downtimeTrend);
        const stdDevDowntime = d3.deviation(downtimeTrend) || 0;
        
        const peakDays = downtimeTrend.map((value, index) => ({
            day: index + 1,
            value: value,
            isPeak: value > avgDowntime + 1.5 * stdDevDowntime
        })).filter(d => d.isPeak);
        
        if (peakDays.length > 0) {
            insightElement.innerHTML = `<i class="bi bi-graph-up"></i> Significant downtime spikes detected on days ${peakDays.map(d => d.day).join(', ')}. Investigate potential equipment failures or maintenance events.`;
        } else {
            insightElement.innerHTML = `<i class="bi bi-info-circle"></i> Downtime for Workstation ${state.selectedWorkstation} follows a consistent pattern without major spikes.`;
        }
    }
}

// Add this to the updateDashboard function
function updateDashboard() {
    try {
        updateKPIs();
        updateProductionChart();
        updateWorkstationStatus();
        updateWorkstationPerformance();
        updateSupplierOccupancy();
        updateProductQuality();
        updateWorkstationDetails();
        
        // Add this new call
        updateStorytellingElements();
    } catch (error) {
        console.error("Error updating dashboard:", error);
        showErrorMessage("An error occurred while updating the dashboard. Please try refreshing the page.");
    }
}

function updateDashboardSummary() {
    try {
        if (!state.data.kpi || !state.data.plant || !state.data.workstation) return;
        
        // Get references to summary elements
        const findingsElement = document.getElementById('summaryFindings');
        const issuesElement = document.getElementById('summaryIssues');
        const actionsElement = document.getElementById('summaryActions');
        const nextStepsElement = document.getElementById('summaryNextSteps');
        
        // Clear existing content
        findingsElement.innerHTML = '';
        issuesElement.innerHTML = '';
        actionsElement.innerHTML = '';
        
        // Extract key metrics
        const kpiData = state.data.kpi;
        const avgProduction = Math.round(kpiData.avg_daily_production);
        const qualityRate = kpiData.avg_quality_percentage.toFixed(1);
        const avgDowntime = kpiData.avg_downtime_hours.toFixed(1);
        const bottleneckWS = kpiData.bottleneck_workstation;
        
        // Calculate plant-level metrics
        const plantData = state.data.plant;
        const totalProduction = d3.sum(plantData, d => d.total_production);
        const avgQualityPercentage = d3.mean(plantData, d => d.quality_percentage);
        
        // Group workstation data
        const workstationGroups = _.groupBy(state.data.workstation, 'workstation');
        
        // Calculate average active time percentage for each workstation
        const wsEfficiency = Object.entries(workstationGroups).map(([ws, data]) => {
            return {
                workstation: parseInt(ws),
                active_percentage: d3.mean(data, d => d.active_percentage)
            };
        });
        
        // Sort by active percentage (descending)
        wsEfficiency.sort((a, b) => b.active_percentage - a.active_percentage);
        
        // Most efficient workstation
        const mostEfficientWS = wsEfficiency[0];
        
        // Least efficient workstation
        const leastEfficientWS = wsEfficiency[wsEfficiency.length - 1];
        
        // Generate findings
        const findings = [
            `<li class="mb-2"><i class="bi bi-check-circle text-success me-2"></i> Average daily production: <strong>${avgProduction}</strong> units</li>`,
            `<li class="mb-2"><i class="bi bi-check-circle text-success me-2"></i> Overall quality rate: <strong>${qualityRate}%</strong></li>`,
            `<li class="mb-2"><i class="bi bi-check-circle text-success me-2"></i> Workstation ${mostEfficientWS.workstation} has the highest efficiency at <strong>${mostEfficientWS.active_percentage.toFixed(1)}%</strong> active time</li>`
        ];
        
        // Generate issues
        const issues = [
            `<li class="mb-2"><i class="bi bi-exclamation-circle text-warning me-2"></i> Workstation ${bottleneckWS} identified as the main bottleneck</li>`,
            `<li class="mb-2"><i class="bi bi-exclamation-circle text-warning me-2"></i> Average downtime across workstations: <strong>${avgDowntime}</strong> hours</li>`,
            `<li class="mb-2"><i class="bi bi-exclamation-circle text-warning me-2"></i> Workstation ${leastEfficientWS.workstation} has the lowest efficiency at <strong>${leastEfficientWS.active_percentage.toFixed(1)}%</strong> active time</li>`
        ];
        
        // Generate recommended actions
        const actions = [
            `<li class="mb-2"><i class="bi bi-lightning text-primary me-2"></i> Implement preventive maintenance for Workstation ${bottleneckWS} to reduce downtime</li>`,
            `<li class="mb-2"><i class="bi bi-lightning text-primary me-2"></i> Optimize material flow to reduce waiting time at Workstation ${leastEfficientWS.workstation}</li>`,
            `<li class="mb-2"><i class="bi bi-lightning text-primary me-2"></i> Study best practices at Workstation ${mostEfficientWS.workstation} for potential implementation at other stations</li>`
        ];
        
        // Add quality-related action if quality is below 90%
        if (qualityRate < 90) {
            actions.push(`<li class="mb-2"><i class="bi bi-lightning text-primary me-2"></i> Implement additional quality control measures to improve overall quality rate</li>`);
        }
        
        // Update HTML content
        findingsElement.innerHTML = findings.join('');
        issuesElement.innerHTML = issues.join('');
        actionsElement.innerHTML = actions.join('');
        
        // Update next steps based on most critical issues
        if (avgDowntime > 10) {
            nextStepsElement.innerHTML = `<strong>High Priority:</strong> Focus on reducing downtime at Workstation ${bottleneckWS} through preventive maintenance and process optimization to improve overall production flow.`;
        } else if (qualityRate < 90) {
            nextStepsElement.innerHTML = `<strong>High Priority:</strong> Implement quality control improvements across all workstations, particularly focusing on stations with the highest reject rates.`;
        } else {
            nextStepsElement.innerHTML = `<strong>Opportunity:</strong> Look for incremental efficiency improvements by optimizing workstation layouts and material flows. Consider expanding production capacity.`;
        }
        
    } catch (error) {
        console.error("Error updating dashboard summary:", error);
    }
}

// Helper Functions

// Aggregate time series data by specified time range
function aggregateTimeSeriesData(dailyData, timeRange) {
    if (!dailyData) return [];
    
    // Group data by time period based on selected range
    let groupedData;
    
    switch (timeRange) {
        case 'day':
            // For daily view, just return the data as-is, but limit to first 30 days for clarity
            return dailyData.slice(0, 30);
            
        case 'week':
            // Group by week (assuming date format is 'YYYY-MM-DD')
            groupedData = _.groupBy(dailyData, d => {
                const date = new Date(d.date);
                // Get week number (approximate by dividing day of year by 7)
                const startOfYear = new Date(date.getFullYear(), 0, 0);
                const dayOfYear = Math.floor((date - startOfYear) / (24 * 60 * 60 * 1000));
                return `Week ${Math.ceil(dayOfYear / 7)}`;
            });
            break;
            
        case 'month':
            // Group by month
            groupedData = _.groupBy(dailyData, d => {
                const date = new Date(d.date);
                return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
            });
            break;
            
        case 'quarter':
            // Group by quarter
            groupedData = _.groupBy(dailyData, d => {
                const date = new Date(d.date);
                const quarter = Math.floor(date.getMonth() / 3) + 1;
                return `Q${quarter} ${date.getFullYear()}`;
            });
            break;
            
        case 'year':
            // Group by year
            groupedData = _.groupBy(dailyData, d => {
                const date = new Date(d.date);
                return date.getFullYear().toString();
            });
            break;
    }
    
    // Aggregate the grouped data
    const aggregatedData = Object.entries(groupedData).map(([period, data]) => {
        return {
            period,
            production: d3.sum(data, d => d.production),
            faulty: d3.sum(data, d => d.faulty)
        };
    });
    
    // Sort by period
    return aggregatedData.sort((a, b) => a.period.localeCompare(b.period));
}

// Get appropriate label for time range axis
function getTimeRangeLabel(timeRange) {
    switch (timeRange) {
        case 'day':
            return 'Day';
        case 'week':
            return 'Week';
        case 'month':
            return 'Month';
        case 'quarter':
            return 'Quarter';
        case 'year':
            return 'Year';
        default:
            return 'Time Period';
    }
}

// Show tooltip with formatted content
function showTooltip(event, content) {
    const tooltip = d3.select('body')
        .append('div')
        .attr('class', 'tooltip')
        .style('opacity', 0)
        .style('position', 'absolute')
        .style('background-color', 'rgba(0, 0, 0, 0.8)')
        .style('color', 'white')
        .style('padding', '8px 12px')
        .style('border-radius', '4px')
        .style('pointer-events', 'none')
        .style('z-index', '1000')
        .style('font-size', '0.8rem')
        .style('max-width', '300px')
        .html(content);
    
    tooltip.style('left', (event.pageX + 10) + 'px')
           .style('top', (event.pageY - 28) + 'px')
           .transition()
           .duration(200)
           .style('opacity', 1);
}

// Hide all tooltips
function hideTooltip() {
    d3.selectAll('.tooltip')
        .transition()
        .duration(200)
        .style('opacity', 0)
        .remove();
}

// Show loading indicator
function showLoading() {
    // Remove any existing loading indicators
    hideLoading();
    
    // Add loading indicator to each chart container
    const containers = [
        '#productionChart',
        '#workstationStatus',
        '#workstationPerformance',
        '#supplierOccupancy',
        '#productQuality',
        '#workstationDetails'
    ];
    
    containers.forEach(container => {
        d3.select(container)
            .append('div')
            .attr('class', 'loading-indicator')
            .html(`
                <div class="loading-spinner"></div>
                <div>Loading data...</div>
            `);
    });
}

// Hide loading indicator
function hideLoading() {
    d3.selectAll('.loading-indicator').remove();
}

// Show error message
function showErrorMessage(message) {
    const containers = [
        '#productionChart',
        '#workstationStatus',
        '#workstationPerformance',
        '#supplierOccupancy',
        '#productQuality',
        '#workstationDetails'
    ];
    
    containers.forEach(container => {
        d3.select(container)
            .append('div')
            .attr('class', 'error-message')
            .style('color', '#f44336')
            .style('text-align', 'center')
            .style('padding', '20px')
            .text(message);
    });
}

// Create and update product quality chart
function updateProductQuality() {
    if (!state.data.product) return;
    
    // Clear previous chart
    d3.select('#productQuality').html('');
    
    // Group data by product type
    const productGroups = _.groupBy(state.data.product, 'product_type');
    
    // Calculate average metrics for each product type
    const productData = Object.entries(productGroups).map(([type, data]) => {
        return {
            product_type: type,
            total_production: d3.sum(data, d => d.production_count),
            total_faulty: d3.sum(data, d => d.faulty_count),
            quality_rate: d3.mean(data, d => d.quality_rate)
        };
    });
    
    // Prepare dimensions
    const container = document.getElementById('productQuality');
    const width = container.clientWidth;
    const height = container.clientHeight;
    const margin = { top: 30, right: 30, bottom: 50, left: 40 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    
    // Create SVG
    const svg = d3.select('#productQuality')
        .append('svg')
        .attr('width', width)
        .attr('height', height);
    
    // Create pie chart
    const radius = Math.min(innerWidth, innerHeight) / 2;
    
    const pieData = productData.map(d => ({
        name: d.product_type,
        value: d.total_production,
        faulty: d.total_faulty,
        quality: d.quality_rate
    }));
    
    const pie = d3.pie()
        .value(d => d.value)
        .sort(null);
    
    const arc = d3.arc()
        .innerRadius(radius * 0.4)  // Create a donut chart
        .outerRadius(radius);
    
    const chart = svg.append('g')
        .attr('transform', `translate(${innerWidth / 2 + margin.left}, ${innerHeight / 2 + margin.top})`);
    
    // Add the pie slices
    const slices = chart.selectAll('.slice')
        .data(pie(pieData))
        .enter()
        .append('g')
        .attr('class', 'slice');
    
    slices.append('path')
        .attr('d', arc)
        .attr('fill', d => colorScales.products(d.data.name))
        .attr('stroke', 'white')
        .style('stroke-width', '2px')
        .on('mouseover', function(event, d) {
            showTooltip(event, `
                <strong>${d.data.name}</strong><br>
                Production: ${d.data.value.toLocaleString()} units<br>
                Faulty: ${d.data.faulty.toLocaleString()} units<br>
                Quality Rate: ${d.data.quality.toFixed(1)}%
            `);
            d3.select(this).attr('opacity', 0.8);
        })
        .on('mouseout', function() {
            hideTooltip();
            d3.select(this).attr('opacity', 1);
        });
    
    // Add labels
    slices.append('text')
        .attr('transform', d => `translate(${arc.centroid(d)})`)
        .attr('text-anchor', 'middle')
        .attr('dy', '.35em')
        .text(d => `${d.data.name}`)
        .style('font-size', '12px')
        .style('fill', 'white')
        .style('font-weight', 'bold');
    
    // Add title
    svg.append('text')
        .attr('class', 'chart-title')
        .attr('x', width / 2)
        .attr('y', margin.top / 2)
        .attr('text-anchor', 'middle')
        .text('Product Distribution by Type');
    
    // Add legend
    const legend = svg.append('g')
        .attr('transform', `translate(${innerWidth + margin.left - 80}, ${margin.top})`);
    
    productData.forEach((product, i) => {
        const legendItem = legend.append('g')
            .attr('transform', `translate(0, ${i * 25})`);
        
        legendItem.append('rect')
            .attr('width', 15)
            .attr('height', 15)
            .attr('fill', colorScales.products(product.product_type));
        
        legendItem.append('text')
            .attr('x', 20)
            .attr('y', 12)
            .text(`${product.product_type} (${product.quality_rate.toFixed(1)}%)`)
            .style('font-size', '12px');
    });
}