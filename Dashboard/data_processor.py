import os
import json
import random
import numpy as np
from datetime import datetime, timedelta

def process_and_save_results(simulation_results, output_dir="dashboard/data"):
    """
    Process simulation results and save as JSON files for dashboard visualization
    
    Args:
        simulation_results: List of simulation run results
        output_dir: Directory to save processed files
    
    Returns:
        Status dictionary with processing information
    """
    # Create output directory if it doesn't exist
    os.makedirs(output_dir, exist_ok=True)
    
    # Initialize processing status
    status = {
        "processed_files": [],
        "error": None,
        "success": True,
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }
    
    try:
        # Process and save data files
        
        # 1. Daily production data
        daily_data = process_daily_production(simulation_results)
        save_json_file(daily_data, os.path.join(output_dir, "daily_production.json"))
        status["processed_files"].append("daily_production.json")
        
        # 2. Workstation performance
        workstation_data = process_workstation_performance(simulation_results)
        save_json_file(workstation_data, os.path.join(output_dir, "workstation_performance.json"))
        status["processed_files"].append("workstation_performance.json")
        
        # 3. Plant performance
        plant_data = process_plant_performance(simulation_results)
        save_json_file(plant_data, os.path.join(output_dir, "plant_performance.json"))
        status["processed_files"].append("plant_performance.json")
        
        # 4. Product data
        product_data = process_product_data(simulation_results)
        save_json_file(product_data, os.path.join(output_dir, "product_data.json"))
        status["processed_files"].append("product_data.json")
        
        # 5. KPI summary
        kpi_data = process_kpi_summary(simulation_results)
        save_json_file(kpi_data, os.path.join(output_dir, "kpi_summary.json"))
        status["processed_files"].append("kpi_summary.json")
        
        print(f"Successfully processed and saved {len(status['processed_files'])} data files")
        
    except Exception as e:
        status["success"] = False
        status["error"] = str(e)
        print(f"Error processing simulation results: {e}")
        
        # Create fallback datasets if processing fails
        try:
            create_fallback_datasets(output_dir)
            status["message"] = "Used fallback data due to processing error"
        except Exception as fallback_error:
            status["fallback_error"] = str(fallback_error)
    
    return status

def save_json_file(data, file_path):
    """Save data as JSON file with proper formatting"""
    with open(file_path, 'w') as f:
        json.dump(data, f, indent=2)
    print(f"Saved: {file_path}")

def process_daily_production(results):
    """Process simulation results into daily production data with high variability"""
    # Generate 90 days of data
    start_date = datetime(2025, 1, 1)
    
    daily_data = []
    
    # Get baseline metrics from simulation results with high variability
    avg_production = np.mean([r["Final Production"] for r in results]) / 30  # per day
    avg_faulty = np.mean([r["Faulty Products"] for r in results]) / 30  # per day
    avg_downtime = np.array([r["Downtime per WS"] for r in results]).mean(axis=0) / 30  # per day per workstation
    
    # Determine if we want to show an improving or worsening trend
    trend_direction = random.choice(['improving', 'worsening', 'volatile', 'stable'])
    
    # Generate daily data with significant randomness
    for day in range(90):
        current_date = start_date + timedelta(days=day)
        date_str = current_date.strftime("%Y-%m-%d")
        
        # Add some weekly patterns with high variability
        day_of_week = current_date.weekday()
        weekend_factor = random.uniform(0.6, 0.8) if day_of_week >= 5 else random.uniform(0.95, 1.2)
        
        # Add random events (like holidays, special productions)
        if random.random() < 0.05:  # 5% chance of a special event
            special_event_factor = random.choice([
                random.uniform(0.3, 0.5),  # Major disruption
                random.uniform(1.5, 2.0)   # Production surge
            ])
            weekend_factor *= special_event_factor
        
        # Add trend based on chosen direction
        if trend_direction == 'improving':
            # Gradually improving performance
            trend_factor = 1.0 + (day / 90) * random.uniform(0.2, 0.5)
        elif trend_direction == 'worsening':
            # Gradually worsening performance
            trend_factor = 1.0 - (day / 90) * random.uniform(0.1, 0.3)
        elif trend_direction == 'volatile':
            # Highly volatile performance
            if day % 15 < 7:  # Cycles of good and bad periods
                trend_factor = random.uniform(1.1, 1.4)
            else:
                trend_factor = random.uniform(0.7, 0.9)
        else:  # stable
            # Relatively stable with some noise
            trend_factor = random.uniform(0.95, 1.05)
        
        # Create significant random noise
        noise = random.uniform(0.7, 1.5)
        
        # Calculate production metrics for this day
        production = round(avg_production * weekend_factor * trend_factor * noise)
        
        # Quality doesn't always correlate with production
        quality_factor = random.uniform(0.8, 1.2)  # Independent quality factor
        faulty = round(avg_faulty * weekend_factor * quality_factor * noise)
        
        # Make sure faulty doesn't exceed production
        faulty = min(faulty, max(1, int(production * 0.5)))
        
        # Different noise for workstation downtime - some days have specific workstation issues
        ws_downtime = []
        for i, dt in enumerate(avg_downtime):
            # Occasionally have a major issue with one workstation
            if random.random() < 0.1:  # 10% chance per workstation per day
                ws_downtime.append(dt * random.uniform(1.5, 3.0))
            else:
                ws_downtime.append(dt * weekend_factor * random.uniform(0.7, 1.4))
        
        # Add the data point
        daily_data.append({
            "date": date_str,
            "production": production,
            "faulty": faulty,
            "workstation_downtime": ws_downtime,
            "total_downtime": sum(ws_downtime),
            "trend_type": trend_direction
        })
    
    # Add timestamp to verify data updates
    daily_data[0]["timestamp"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    return daily_data

def process_workstation_performance(results):
    """Process simulation results into workstation performance metrics with high variability"""
    # Extract number of workstations from results
    num_workstations = len(results[0]["Downtime per WS"]) if results else 6
    
    # Generate significantly varied failure probabilities
    # Each simulation will have drastically different workstation characteristics
    failure_probs = []
    for _ in range(num_workstations):
        failure_probs.append(random.uniform(0.05, 0.3))
    
    # Randomly choose one workstation to be significantly worse (bottleneck)
    bottleneck_ws = random.randint(0, num_workstations-1)
    failure_probs[bottleneck_ws] = random.uniform(0.25, 0.4)
    
    # Randomly choose one workstation to be significantly better (star performer)
    star_ws = random.choice([i for i in range(num_workstations) if i != bottleneck_ws])
    failure_probs[star_ws] = random.uniform(0.03, 0.08)
    
    # Generate performance data for each workstation across multiple runs
    workstation_data = []
    
    for run_idx, run in enumerate(results):
        for ws_idx in range(num_workstations):
            # Apply high variance to performance metrics
            variance_factor = random.uniform(0.7, 1.5)
            
            # Calculate time distributions with higher variability
            total_time = 100
            
            # Downtime is affected by failure probability with high variance
            downtime_base = (run["Downtime per WS"][ws_idx] / 30)
            downtime_percentage = min(95, max(5, downtime_base * variance_factor * random.uniform(0.7, 1.5)))
            
            # Waiting time affected by bottleneck effects and supplier delays
            waiting_base = (run["Workstation Delays"][ws_idx] / 30)
            waiting_percentage = min(80, max(5, waiting_base * variance_factor * random.uniform(0.7, 1.5)))
            
            # Ensure percentages don't exceed 100%
            if downtime_percentage + waiting_percentage > 95:
                ratio = 95 / (downtime_percentage + waiting_percentage)
                downtime_percentage *= ratio
                waiting_percentage *= ratio
            
            active_percentage = 100 - downtime_percentage - waiting_percentage
            
            # Calculate derived metrics with high variance
            downtime = downtime_base * variance_factor * random.uniform(0.7, 1.5)
            waiting_time = waiting_base * variance_factor * random.uniform(0.7, 1.5)
            active_time = total_time - downtime - waiting_time
            
            # Add workstation data
            workstation_data.append({
                "run": run_idx,
                "workstation": ws_idx + 1,
                "downtime": downtime,
                "waiting_time": waiting_time,
                "active_time": active_time,
                "downtime_percentage": downtime_percentage,
                "waiting_percentage": waiting_percentage,
                "active_percentage": active_percentage,
                "failure_probability": failure_probs[ws_idx] * random.uniform(0.8, 1.2),
                "is_bottleneck": ws_idx == bottleneck_ws,
                "is_star_performer": ws_idx == star_ws
            })
    
    # Add timestamp to verify data updates
    if workstation_data:
        workstation_data[0]["timestamp"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    return workstation_data

def process_plant_performance(results):
    """Process simulation results into plant-level performance metrics with high variability"""
    plant_data = []
    
    # Generate a random plant efficiency factor for this dataset
    plant_efficiency = random.uniform(0.7, 1.3)
    
    # Generate a random quality control factor
    quality_control = random.uniform(0.8, 1.2)
    
    # Generate a random supplier reliability factor
    supplier_reliability = random.uniform(0.7, 1.3)
    
    for run_idx, run in enumerate(results):
        # Apply high variance to run-specific results
        run_variance = random.uniform(0.7, 1.5)
        
        # Calculate plant-level metrics with significant variability
        total_production = run["Final Production"] * plant_efficiency * run_variance
        
        # Quality affected by different factors than production
        quality_variance = random.uniform(0.7, 1.5)
        faulty_products = run["Faulty Products"] * (2.0 - quality_control) * quality_variance
        
        # Ensure faulty doesn't exceed production
        faulty_products = min(faulty_products, max(1, total_production * 0.5))
        
        # Calculate quality percentage
        quality_percentage = 100 * (total_production - faulty_products) / total_production if total_production > 0 else 0
        
        # Supplier and bottleneck metrics with high variance
        supplier_variance = random.uniform(0.6, 1.6)
        supplier_occupancy = run["Supplier Occupancy"] / 30 * (1.0 / supplier_reliability) * supplier_variance
        
        bottleneck_variance = random.uniform(0.7, 1.5)
        bottleneck_delay = run["Bottleneck Delay"] / 30 * (1.0 / plant_efficiency) * bottleneck_variance
        
        # Add run data
        plant_data.append({
            "run": run_idx,
            "total_production": int(total_production),
            "faulty_products": int(faulty_products),
            "quality_percentage": quality_percentage,
            "supplier_occupancy": supplier_occupancy,
            "bottleneck_delay": bottleneck_delay,
            "avg_downtime": sum(run["Downtime per WS"]) / len(run["Downtime per WS"]) / 30 * run_variance,
            "plant_efficiency_factor": plant_efficiency,
            "quality_control_factor": quality_control,
            "supplier_reliability_factor": supplier_reliability
        })
    
    # Add timestamp to verify data updates
    if plant_data:
        plant_data[0]["timestamp"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    return plant_data

def process_product_data(results):
    """Generate product-type specific data with high variability"""
    product_data = []
    
    # Define product types
    product_types = ["Type A", "Type B", "Type C"]
    
    # Generate varied product characteristics for this dataset
    product_characteristics = {}
    for product_type in product_types:
        # Each product has its own production volume and quality characteristics
        product_characteristics[product_type] = {
            "volume_factor": random.uniform(0.6, 1.5),
            "quality_base": random.uniform(0.75, 0.95),
            "quality_variance": random.uniform(0.05, 0.15)
        }
    
    # Generate data per run and product type
    for run_idx, run in enumerate(results):
        # Get total production from run with high variability
        total_production = run["Final Production"] * random.uniform(0.9, 1.1)
        
        # Distribution will vary significantly between refreshes
        # Sometimes one product dominates, other times it's more balanced
        distribution_type = random.choice(['balanced', 'dominant_a', 'dominant_b', 'dominant_c'])
        
        if distribution_type == 'balanced':
            # Relatively balanced distribution with some variance
            type_a_pct = random.uniform(0.3, 0.4)
            type_b_pct = random.uniform(0.3, 0.4)
            type_c_pct = 1.0 - type_a_pct - type_b_pct
        elif distribution_type == 'dominant_a':
            # Type A dominates
            type_a_pct = random.uniform(0.5, 0.7)
            type_b_pct = random.uniform(0.15, 0.3)
            type_c_pct = 1.0 - type_a_pct - type_b_pct
        elif distribution_type == 'dominant_b':
            # Type B dominates
            type_a_pct = random.uniform(0.15, 0.3)
            type_b_pct = random.uniform(0.5, 0.7)
            type_c_pct = 1.0 - type_a_pct - type_b_pct
        else:  # dominant_c
            # Type C dominates
            type_a_pct = random.uniform(0.15, 0.3)
            type_b_pct = random.uniform(0.15, 0.3)
            type_c_pct = 1.0 - type_a_pct - type_b_pct
        
        # Generate data for each product type
        for product_type in product_types:
            # Apply product-specific volume factor to create more variance
            volume_factor = product_characteristics[product_type]["volume_factor"] * random.uniform(0.8, 1.2)
            
            if product_type == "Type A":
                production_pct = type_a_pct * volume_factor
            elif product_type == "Type B":
                production_pct = type_b_pct * volume_factor
            else:
                production_pct = type_c_pct * volume_factor
            
            # Normalize percentages in case they exceed 1.0 due to variance
            total_pct = type_a_pct * product_characteristics["Type A"]["volume_factor"] + \
                        type_b_pct * product_characteristics["Type B"]["volume_factor"] + \
                        type_c_pct * product_characteristics["Type C"]["volume_factor"]
            
            production_pct = production_pct / total_pct
                
            # Calculate production counts with higher variability
            production_count = int(total_production * production_pct * random.uniform(0.9, 1.1))
            
            # Calculate quality with product-specific base and variance
            quality_base = product_characteristics[product_type]["quality_base"]
            quality_variance = product_characteristics[product_type]["quality_variance"]
            quality_rate = (quality_base + random.uniform(-quality_variance, quality_variance)) * 100
            
            # Ensure quality rate is between 60% and 99.9%
            quality_rate = min(99.9, max(60.0, quality_rate))
            
            # Calculate faulty count based on quality rate
            faulty_count = int(production_count * (1 - quality_rate/100) * random.uniform(0.9, 1.1))
            
            # Ensure faulty count is reasonable
            faulty_count = min(faulty_count, production_count - 1)
            
            # Add product data
            product_data.append({
                "run": run_idx,
                "product_type": product_type,
                "production_count": production_count,
                "faulty_count": faulty_count,
                "quality_rate": quality_rate,
                "distribution_type": distribution_type
            })
    
    # Add timestamp to verify data updates
    if product_data:
        product_data[0]["timestamp"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    return product_data

def process_kpi_summary(results):
    """Generate KPI summary data with high variability"""
    # Calculate KPIs from simulation results with high variability
    
    # Apply a global variance factor for this refresh
    variance_factor = random.uniform(0.8, 1.2)
    
    # Randomly select a performance scenario
    performance_scenario = random.choice(['excellent', 'good', 'average', 'challenging', 'critical'])
    
    # Set scenario-based modifiers
    if performance_scenario == 'excellent':
        production_mod = random.uniform(1.2, 1.4)
        quality_mod = random.uniform(1.05, 1.1)
        downtime_mod = random.uniform(0.6, 0.8)
    elif performance_scenario == 'good':
        production_mod = random.uniform(1.05, 1.2)
        quality_mod = random.uniform(1.0, 1.05)
        downtime_mod = random.uniform(0.8, 0.95)
    elif performance_scenario == 'average':
        production_mod = random.uniform(0.95, 1.05)
        quality_mod = random.uniform(0.95, 1.05)
        downtime_mod = random.uniform(0.95, 1.05)
    elif performance_scenario == 'challenging':
        production_mod = random.uniform(0.8, 0.95)
        quality_mod = random.uniform(0.9, 0.98)
        downtime_mod = random.uniform(1.05, 1.2)
    else:  # critical
        production_mod = random.uniform(0.6, 0.8)
        quality_mod = random.uniform(0.8, 0.9)
        downtime_mod = random.uniform(1.2, 1.5)
    
    # Calculate base values from simulation results
    base_daily_production = np.mean([r["Final Production"] for r in results]) / 30  # per day
    
    # Calculate quality percentage with high variability
    quality_values = []
    for run in results:
        if run["Final Production"] > 0:
            quality = (run["Final Production"] - run["Faulty Products"]) / run["Final Production"] * 100
            quality_values.append(quality)
    base_quality_percentage = np.mean(quality_values) if quality_values else 90.0
    
    # Calculate downtime with high variability
    downtime_per_ws = np.array([r["Downtime per WS"] for r in results]).mean(axis=0) / 30  # daily average
    base_downtime_hours = np.mean(downtime_per_ws)
    
    # Apply modifiers and variance
    avg_daily_production = base_daily_production * production_mod * variance_factor
    avg_quality_percentage = base_quality_percentage * quality_mod
    avg_downtime_hours = base_downtime_hours * downtime_mod * variance_factor
    
    # Ensure quality percentage is between 70% and 99.9%
    avg_quality_percentage = min(99.9, max(70.0, avg_quality_percentage))
    
    # Identify bottleneck workstation - simulate some variance in bottleneck detection
    modified_downtime = [dt * random.uniform(0.9, 1.1) for dt in downtime_per_ws]
    bottleneck_workstation = np.argmax(modified_downtime) + 1  # +1 for 1-indexed workstation numbers
    
    # Return KPI data with timestamp
    return {
        "avg_daily_production": avg_daily_production,
        "avg_quality_percentage": avg_quality_percentage,
        "avg_downtime_hours": avg_downtime_hours,
        "bottleneck_workstation": int(bottleneck_workstation),
        "performance_scenario": performance_scenario,
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }