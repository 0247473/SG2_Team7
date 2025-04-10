import http.server
import socketserver
import os
import json
import time
from urllib.parse import urlparse, parse_qs

PORT = 8000  

# Custom request handler
class DashboardHandler(http.server.SimpleHTTPRequestHandler):
    # Set the root directory to serve files from
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=".", **kwargs)
    
    def do_GET(self):
        # Parse URL
        parsed_url = urlparse(self.path)
        
        # Redirect data requests to dashboard/data or data directory
        if parsed_url.path.startswith('/data/'):
            # Try to find the file in dashboard/data first, then in data
            file_name = os.path.basename(parsed_url.path)
            dashboard_data_path = os.path.join('dashboard', 'data', file_name)
            data_path = os.path.join('data', file_name)
            
            # Check which path exists
            if os.path.exists(dashboard_data_path):
                self.path = f'/dashboard/data/{file_name}'
            elif os.path.exists(data_path):
                self.path = f'/data/{file_name}'
            
            # Add cache control headers
            self.send_response(200)
            self.send_header('Content-type', self.guess_type(self.path))
            self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
            self.send_header('Pragma', 'no-cache')
            self.send_header('Expires', '0')
            self.end_headers()
            
            try:
                # Open the file and send its contents
                with open(self.path[1:], 'rb') as f:
                    self.wfile.write(f.read())
                return
            except Exception as e:
                print(f"Error serving file {self.path}: {e}")
                # If file opening fails, continue with default handling
                self.send_response(404)
                self.send_header('Content-type', 'text/plain')
                self.end_headers()
                self.wfile.write(f"File not found: {file_name}".encode())
                return
        
        # Redirect static file requests if needed
        elif parsed_url.path.startswith('/static/'):
            # Check if the file exists in the static directory, if not, try in dashboard/static
            file_path = parsed_url.path[1:]  # Remove leading slash
            if not os.path.exists(file_path) and os.path.exists(f"dashboard/{file_path}"):
                self.path = f'/dashboard{parsed_url.path}'
        
        # Handle API requests
        elif parsed_url.path.startswith('/api/'):
            self.handle_api_request(parsed_url)
            return
            
        # Special case for root path - redirect to dashboard.html
        elif parsed_url.path == '/' or parsed_url.path == '':
            self.path = '/dashboard.html'
            
        # Default behavior for static files
        return http.server.SimpleHTTPRequestHandler.do_GET(self)
    
    def handle_api_request(self, parsed_url):
        """Handle API requests"""
        
        # Parse path and query
        path = parsed_url.path
        query = parse_qs(parsed_url.query)
        
        # API endpoints
        if path == '/api/run-simulation':
            self.handle_run_simulation(query)
        else:
            # Invalid API endpoint
            self.send_response(404)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            response = {'error': 'API endpoint not found'}
            self.wfile.write(json.dumps(response).encode())
    
    def handle_run_simulation(self, query):
        """Run simulation with parameters from query"""
        
        try:
            # Inform client we're starting
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Cache-Control', 'no-cache')
            self.end_headers()
            
            # Initial response
            initial_response = {'status': 'running', 'message': 'Starting simulation...'}
            self.wfile.write(json.dumps(initial_response).encode())
            
            # Import simulation module
            try:
                import simulation_integrated
            except ImportError as e:
                print(f"Error importing simulation module: {e}")
                error_msg = {'status': 'error', 'message': f'Failed to import simulation module: {str(e)}'}
                self.wfile.write(json.dumps(error_msg).encode())
                return
            
            # Extract parameters from query (if any)
            params = {}
            for key, value in query.items():
                params[key] = value[0]
            
            # Run simulation with error handling
            print("Running simulation with parameters:", params)
            try:
                results = simulation_integrated.run_simulation()
            except Exception as sim_error:
                print(f"Error during simulation execution: {sim_error}")
                error_msg = {'status': 'error', 'message': f'Simulation execution failed: {str(sim_error)}'}
                self.wfile.write(json.dumps(error_msg).encode())
                return
            
            # Process results for the dashboard
            try:
                from data_processor import process_and_save_results
                process_status = process_and_save_results(results, "dashboard/data")
                print(f"Data processing result: {process_status}")
            except Exception as proc_error:
                print(f"Error during data processing: {proc_error}")
                error_msg = {'status': 'error', 'message': f'Data processing failed: {str(proc_error)}'}
                self.wfile.write(json.dumps(error_msg).encode())
                return
            
            # Also generate copies in the data folder for compatibility
            output_dir = "data"
            os.makedirs(output_dir, exist_ok=True)
            try:
                for file in os.listdir('dashboard/data'):
                    if file.endswith('.json'):
                        with open(f'dashboard/data/{file}', 'r') as src, open(f'{output_dir}/{file}', 'w') as dst:
                            dst.write(src.read())
                        print(f"Data file copied to {output_dir}: {file}")
            except Exception as e:
                print(f"Error copying data files: {e}")
                # We'll continue even if copying fails
            
            # Simulate a small delay to ensure files are written
            time.sleep(1)
            
            # Send success response
            response = {'status': 'success', 'message': 'Simulation completed successfully'}
            self.wfile.write(json.dumps(response).encode())
            
            print("Simulation completed successfully!")
            
        except Exception as e:
            # Send error response with detailed information
            print(f"Unexpected error during simulation process: {e}")
            import traceback
            traceback_str = traceback.format_exc()
            print(f"Traceback: {traceback_str}")
            
            response = {
                'status': 'error', 
                'message': f"Error during simulation: {str(e)}",
                'traceback': traceback_str
            }
            
            try:
                self.wfile.write(json.dumps(response).encode())
            except:
                print("Failed to send error response to client")


# Main server function
def run_server():
    """Start the HTTP server"""
    
    # Ensure all required directories exist
    os.makedirs('data', exist_ok=True)
    os.makedirs('dashboard/data', exist_ok=True)
    os.makedirs('static/css', exist_ok=True)
    os.makedirs('static/js', exist_ok=True)
    
    # Copy CSS and JS files if needed
    if os.path.exists('dashboard_css.css') and not os.path.exists('static/css/dashboard.css'):
        try:
            with open('dashboard_css.css', 'r') as src, open('static/css/dashboard.css', 'w') as dst:
                dst.write(src.read())
            print("CSS file copied to static/css/dashboard.css")
        except Exception as e:
            print(f"Error copying CSS file: {e}")
    
    if os.path.exists('dashboard_js.js') and not os.path.exists('static/js/dashboard.js'):
        try:
            with open('dashboard_js.js', 'r') as src, open('static/js/dashboard.js', 'w') as dst:
                dst.write(src.read())
            print("JS file copied to static/js/dashboard.js")
        except Exception as e:
            print(f"Error copying JS file: {e}")
    
    # Pre-run simulation if data files don't exist
    if not os.path.exists('dashboard/data/daily_production.json'):
        try:
            print("No data files found. Running initial simulation...")
            import simulation_integrated
            results = simulation_integrated.run_simulation()
            
            from data_processor import process_and_save_results
            process_and_save_results(results, "dashboard/data")
            
            # Copy to data directory
            for file in os.listdir('dashboard/data'):
                if file.endswith('.json') and not os.path.exists(f'data/{file}'):
                    with open(f'dashboard/data/{file}', 'r') as src, open(f'data/{file}', 'w') as dst:
                        dst.write(src.read())
                    print(f"Initial data file created: {file}")
        except Exception as e:
            print(f"Error generating initial data: {e}")
    
    # Create server with threading for handling multiple requests
    handler = DashboardHandler
    with socketserver.ThreadingTCPServer(("", PORT), handler) as httpd:
        print(f"Serving dashboard at http://localhost:{PORT}")
        print("Press Ctrl+C to stop the server")
        
        try:
            # Start server
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("Server stopped")
            httpd.server_close()


if __name__ == "__main__":
    run_server()