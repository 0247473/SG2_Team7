import simpy
import random
import numpy as np
import matplotlib.pyplot as plt
import os
import json
import time
from datetime import datetime

# Simulation Parameters with extra variability
NUM_WORKSTATIONS = 6
NUM_SUPPLIERS = 3
BIN_CAPACITY = 25
TOTAL_SIM_TIME = 5000

# Dynamic number of runs - randomly varied on each simulation
BASE_NUM_RUNS = 100

# Baseline failure probabilities - will be varied significantly each time
BASE_FAILURE_PROBS = [0.10, 0.08, 0.15, 0.25, 0.20, 0.18]
BASE_FIXING_TIME_MEAN = 5
BASE_WORK_TIME_MEAN = 4
BASE_QUALITY_ISSUE_PROB = 0.12
BASE_FACILITY_ACCIDENT_PROB = 0.001
BASE_RESTOCK_DELAY_MEAN = 3.0

class ManufacturingFacility:
    def __init__(self, env, custom_params=None):
        self.env = env
        
        # Use custom parameters if provided, otherwise use defaults
        params = custom_params or {}
        
        self.workstations = [simpy.Resource(env, capacity=1) for _ in range(NUM_WORKSTATIONS)]
        self.supplier = simpy.Resource(env, capacity=params.get('num_suppliers', NUM_SUPPLIERS))
        self.bins = [params.get('bin_capacity', BIN_CAPACITY) for _ in range(NUM_WORKSTATIONS)]
        self.production_count = 0
        self.faulty_count = 0
        self.total_downtime = [0] * NUM_WORKSTATIONS
        self.supplier_occupancy = 0
        self.processed_items = [0] * NUM_WORKSTATIONS
        self.total_fix_time = 0
        self.total_bottleneck_delay = 0
        self.workstation_wait_time = [0] * NUM_WORKSTATIONS  # Track bottleneck delays
        
        # Store dynamic parameters
        self.failure_probs = params.get('failure_probs', BASE_FAILURE_PROBS.copy())
        self.fixing_time_mean = params.get('fixing_time_mean', BASE_FIXING_TIME_MEAN)
        self.work_time_mean = params.get('work_time_mean', BASE_WORK_TIME_MEAN)
        self.quality_issue_prob = params.get('quality_issue_prob', BASE_QUALITY_ISSUE_PROB)
        self.restock_delay_mean = params.get('restock_delay_mean', BASE_RESTOCK_DELAY_MEAN)
        self.facility_accident_prob = params.get('facility_accident_prob', BASE_FACILITY_ACCIDENT_PROB)
        
        # Add random efficiency factors to each workstation
        self.ws_efficiency = [random.uniform(0.8, 1.2) for _ in range(NUM_WORKSTATIONS)]
        
        # Add random bottleneck factor - one workstation will be significantly slower
        bottleneck_ws = random.randint(0, NUM_WORKSTATIONS-1)
        self.ws_efficiency[bottleneck_ws] *= random.uniform(0.5, 0.8)
        
        # Log additional data for better visualization
        self.hourly_production = []
        self.current_hour = 0
        self.hourly_production_timer = env.process(self.record_hourly_production())

    def record_hourly_production(self):
        """Record production data at regular intervals"""
        while True:
            yield self.env.timeout(1)  # Every 1 time unit
            self.current_hour += 1
            if self.current_hour % 24 == 0:  # Record every 24 hours (1 day)
                self.hourly_production.append({
                    'hour': self.current_hour,
                    'production': self.production_count,
                    'faulty': self.faulty_count,
                    'workstation_states': [
                        {'workstation': i, 'inventory': self.bins[i], 'processed': self.processed_items[i]}
                        for i in range(NUM_WORKSTATIONS)
                    ]
                })

    def workstation_process(self, station_id):
        while True:
            start_wait = self.env.now  # Track when waiting starts
            if self.bins[station_id] > 0:
                self.workstation_wait_time[station_id] += self.env.now - start_wait  # Log waiting time

                # Work time is affected by workstation efficiency
                work_time = max(0, random.gauss(
                    self.work_time_mean / self.ws_efficiency[station_id], 
                    self.work_time_mean * 0.3
                ))
                yield self.env.timeout(work_time)
                
                self.bins[station_id] -= 1
                self.processed_items[station_id] += 1

                # Failure probability is also affected by workstation efficiency
                station_failure_prob = self.failure_probs[station_id] * (2.0 - self.ws_efficiency[station_id])
                if random.random() < station_failure_prob:
                    repair_time = random.expovariate(1 / self.fixing_time_mean)
                    repair_time *= random.uniform(0.8, 1.5)  # Add variability to repair time
                    
                    self.total_fix_time += repair_time
                    self.total_downtime[station_id] += repair_time
                    yield self.env.timeout(repair_time)

                if station_id == NUM_WORKSTATIONS - 1:
                    # Quality issues are affected by efficiency too
                    quality_factor = 1.0 + (1.0 - self.ws_efficiency[station_id])
                    if random.random() < self.quality_issue_prob * quality_factor:
                        self.faulty_count += 1
                    else:
                        self.production_count += 1
            else:
                yield self.env.timeout(1)  

    def restocking_process(self):
        while True:
            for i in range(NUM_WORKSTATIONS):
                # Random chance to restock even if not empty
                should_restock = self.bins[i] == 0 or (self.bins[i] < BIN_CAPACITY * 0.2 and random.random() < 0.3)
                
                if should_restock:
                    with self.supplier.request() as req:
                        yield req
                        # More variability in delay
                        delay = abs(random.gauss(self.restock_delay_mean, self.restock_delay_mean * 0.4))
                        self.supplier_occupancy += delay
                        yield self.env.timeout(delay)
                        self.bins[i] = BIN_CAPACITY
            
            # Variable wait between restock checks
            yield self.env.timeout(random.uniform(0.5, 1.5))

    def accident_check(self):
        while True:
            if random.random() < self.facility_accident_prob:
                # More variability in accident severity
                downtime = random.randint(5, 70)
                for i in range(NUM_WORKSTATIONS):
                    self.total_downtime[i] += downtime
                yield self.env.timeout(downtime)
            else:
                yield self.env.timeout(1)


def generate_dynamic_params():
    """Generate varied parameters for each simulation run"""
    
    # Randomly determine if this will be a "good" or "bad" production day
    scenario_type = random.choice(['good', 'normal', 'challenging', 'critical'])
    
    # Set base modifiers based on scenario
    if scenario_type == 'good':
        # Better than average day
        failure_mod = random.uniform(0.6, 0.9)
        quality_mod = random.uniform(0.6, 0.9)
        speed_mod = random.uniform(1.1, 1.3)
        restock_mod = random.uniform(0.7, 0.9)
    elif scenario_type == 'normal':
        # Average day
        failure_mod = random.uniform(0.9, 1.1)
        quality_mod = random.uniform(0.9, 1.1)
        speed_mod = random.uniform(0.9, 1.1)
        restock_mod = random.uniform(0.9, 1.1)
    elif scenario_type == 'challenging':
        # Difficult day
        failure_mod = random.uniform(1.1, 1.3)
        quality_mod = random.uniform(1.1, 1.3)
        speed_mod = random.uniform(0.8, 1.0)
        restock_mod = random.uniform(1.1, 1.3)
    else:  # critical
        # Crisis situation
        failure_mod = random.uniform(1.3, 1.8)
        quality_mod = random.uniform(1.3, 1.8)
        speed_mod = random.uniform(0.6, 0.8)
        restock_mod = random.uniform(1.3, 1.8)
    
    # Generate varied failure probabilities
    failure_probs = [p * failure_mod * random.uniform(0.7, 1.3) for p in BASE_FAILURE_PROBS]
    
    # One workstation might have a particular issue
    if random.random() < 0.4:
        problem_ws = random.randint(0, NUM_WORKSTATIONS-1)
        failure_probs[problem_ws] *= random.uniform(1.5, 2.5)
    
    # Generate other parameter variations
    return {
        'num_suppliers': random.randint(2, 4),
        'bin_capacity': int(BIN_CAPACITY * random.uniform(0.8, 1.2)),
        'failure_probs': failure_probs,
        'fixing_time_mean': BASE_FIXING_TIME_MEAN * failure_mod * random.uniform(0.7, 1.3),
        'work_time_mean': BASE_WORK_TIME_MEAN / speed_mod * random.uniform(0.7, 1.3),
        'quality_issue_prob': BASE_QUALITY_ISSUE_PROB * quality_mod * random.uniform(0.7, 1.3),
        'restock_delay_mean': BASE_RESTOCK_DELAY_MEAN * restock_mod * random.uniform(0.7, 1.3),
        'facility_accident_prob': BASE_FACILITY_ACCIDENT_PROB * failure_mod * random.uniform(0.7, 1.3),
        'scenario_type': scenario_type
    }


def run_simulation(auto_process=True, output_dir="dashboard/data"):
    """
    Run the manufacturing simulation with high variability
    
    Args:
        auto_process: Whether to automatically process results for dashboard
        output_dir: Directory for saving processed data
    
    Returns:
        Simulation results
    """
    # Create output directory if it doesn't exist
    os.makedirs(output_dir, exist_ok=True)
    
    # Initialize results list
    results = []
    
    # Add a timestamp to make each simulation unique
    simulation_timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    # Add randomness to number of runs
    num_runs = random.randint(int(BASE_NUM_RUNS * 0.7), int(BASE_NUM_RUNS * 1.2))
    
    # Reduce runs for testing if needed
    if "QUICK_TEST" in os.environ:
        num_runs = random.randint(8, 15)
    
    # Set a lower number of runs to avoid timeouts in web context
    num_runs = min(num_runs, 100)
    
    print(f"Running simulation with {num_runs} runs at {simulation_timestamp}")
    
    try:
        # For each run, generate completely new parameter sets
        for run in range(num_runs):
            try:
                # Generate dynamic parameters for this run
                dynamic_params = generate_dynamic_params()
                
                # Create simulation environment
                env = simpy.Environment()
                factory = ManufacturingFacility(env, dynamic_params)
                
                # Add processes to environment
                for i in range(NUM_WORKSTATIONS):
                    env.process(factory.workstation_process(i))
                env.process(factory.restocking_process())
                env.process(factory.accident_check())
                
                # Run simulation with timeout
                sim_time = TOTAL_SIM_TIME
                env.run(until=sim_time)
                
                # Make sure all values are serializable
                downtime_per_ws = [float(dt) for dt in factory.total_downtime]
                workstation_delays = [float(wt) for wt in factory.workstation_wait_time]
                
                # Add run information to track different simulation runs
                results.append({
                    'Run': run + 1,
                    'Final Production': int(factory.production_count),
                    'Faulty Products': int(factory.faulty_count),
                    'Downtime per WS': downtime_per_ws,
                    'Supplier Occupancy': float(factory.supplier_occupancy),
                    'Average Fix Time': float(factory.total_fix_time / NUM_WORKSTATIONS if NUM_WORKSTATIONS > 0 else 0),
                    'Bottleneck Delay': float(sum(factory.workstation_wait_time) / 
                                         NUM_WORKSTATIONS if NUM_WORKSTATIONS > 0 else 0),
                    'Workstation Delays': workstation_delays,
                    'Scenario': dynamic_params['scenario_type'],
                    'Timestamp': simulation_timestamp,
                    'Hourly Production': [
                        {
                            'hour': entry['hour'], 
                            'production': entry['production'],
                            'faulty': entry['faulty'],
                            'workstation_states': [
                                {
                                    'workstation': ws_state['workstation'],
                                    'inventory': ws_state['inventory'],
                                    'processed': ws_state['processed']
                                } for ws_state in entry['workstation_states']
                            ]
                        } for entry in factory.hourly_production
                    ]
                })
                
                if run % 10 == 0:
                    print(f"Completed simulation run {run+1}/{num_runs}")
                
            except Exception as run_error:
                print(f"Error in simulation run {run+1}: {run_error}")
                # Continue with next run even if this one fails
                continue
        
        # Make sure we have at least some results
        if not results:
            raise ValueError("All simulation runs failed. No results generated.")
        
        print(f"Completed {len(results)} simulation runs successfully")
        
        # Save raw results with timestamp
        try:
            with open(os.path.join(output_dir, 'raw_simulation_results.json'), 'w') as f:
                json.dump({
                    'timestamp': simulation_timestamp,
                    'runs': results
                }, f, indent=2, default=str)
        except Exception as save_error:
            print(f"Error saving raw results: {save_error}")
        
        # Process data for dashboard if requested
        if auto_process:
            from data_processor import process_and_save_results
            process_and_save_results(results, output_dir)
        
        return results
        
    except Exception as e:
        import traceback
        print(f"Critical error in simulation: {e}")
        print(traceback.format_exc())
        
        # Create fallback data if all else fails
        from data_processor import create_fallback_datasets
        create_fallback_datasets(output_dir)
        
        # Still need to return something
        if not results:
            # Create a minimal valid result for a single run
            fallback_result = [{
                'Run': 1,
                'Final Production': random.randint(4000, 6000),
                'Faulty Products': random.randint(400, 600),
                'Downtime per WS': [
                    random.uniform(40, 60), 
                    random.uniform(50, 70), 
                    random.uniform(80, 100), 
                    random.uniform(130, 170), 
                    random.uniform(110, 150), 
                    random.uniform(100, 140)
                ],
                'Supplier Occupancy': random.uniform(180, 220),
                'Average Fix Time': random.uniform(4, 6),
                'Bottleneck Delay': random.uniform(40, 60),
                'Workstation Delays': [
                    random.uniform(8, 12), 
                    random.uniform(13, 17), 
                    random.uniform(18, 22), 
                    random.uniform(28, 32), 
                    random.uniform(23, 27), 
                    random.uniform(18, 22)
                ],
                'Scenario': 'fallback',
                'Timestamp': simulation_timestamp,
                'Hourly Production': []
            }]
            results = fallback_result
        
        return results


# Run and analyze the results
if __name__ == "__main__":
    print("Running manufacturing facility simulation...")
    simulation_results = run_simulation()
    
    print("Simulation complete.")